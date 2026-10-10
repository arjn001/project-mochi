import * as vscode from "vscode";
import { ClaudeModel, answer, connect, listModels, toBrainError, toClaudeError, toSavedModels } from "./claude";
import { ClaudeKey } from "./claudeKey";
import { compose } from "./compose";
import { BrainError, Provider, SendOptions } from "./provider";
import { GatedRequest } from "./shareGate";

// The last model listing that worked, so a moment offline doesn't make her
// pick look gone. Model ids and names only, nothing secret. Cleared by
// "Remove my Claude key" and "Forget everything".
export const CLAUDE_MODELS = "mochi.claudeModels";

// How long a listing is trusted before Mochi asks Claude again. The listing
// is free, but each look adds a moment before she gets an answer.
const FRESH_MS = 10 * 60_000;

// The Claude models her key can use (MOCHI-53, part 2).
export class ClaudeModels {
  private fresh: { at: number; models: ClaudeModel[] } | undefined;

  constructor(
    readonly key: ClaudeKey,
    private readonly state: vscode.Memento
  ) {
    // A new key, or none, in this window or another one.
    key.onDidChange(() => this.stale());
  }

  // Empty with no key. If Claude can't be asked, the last listing that
  // worked, or empty.
  async list(): Promise<ClaudeModel[]> {
    const key = await this.key.get();
    if (!key) {
      return [];
    }
    if (this.fresh && Date.now() - this.fresh.at < FRESH_MS) {
      return this.fresh.models;
    }
    const listing = await listModels(connect(key));
    if (!listing.ok) {
      return toSavedModels(this.state.get(CLAUDE_MODELS));
    }
    await this.remember(listing.models);
    return listing.models;
  }

  async remember(models: ClaudeModel[]): Promise<void> {
    this.fresh = { at: Date.now(), models };
    await this.state.update(CLAUDE_MODELS, models);
  }

  // Ask Claude again next time, like after a model wasn't found.
  stale(): void {
    this.fresh = undefined;
  }

  async forget(): Promise<void> {
    this.stale();
    await this.state.update(CLAUDE_MODELS, undefined);
  }

  brain(model: ClaudeModel): Provider {
    return new ClaudeBrain(this, model);
  }
}

// One Claude model, answering with her key. Her key is read fresh for each
// answer and handed only to the Claude client.
class ClaudeBrain implements Provider {
  readonly name: string;
  readonly maxInputTokens: number | undefined;

  constructor(
    private readonly models: ClaudeModels,
    private readonly model: ClaudeModel
  ) {
    this.name = model.name;
    this.maxInputTokens = model.maxInputTokens ?? undefined;
  }

  async isAvailable(): Promise<boolean> {
    return (await this.models.key.get()) !== undefined;
  }

  async *send(request: GatedRequest, instructions: string, { history, signal, soFar }: SendOptions = {}): AsyncIterable<string> {
    const key = await this.models.key.get();
    if (!key) {
      throw new BrainError("keyRejected", "There's no Claude key saved.", "addClaudeKey");
    }
    try {
      yield* answer(connect(key), this.model.id, instructions, compose(request), { history, signal, soFar });
    } catch (error) {
      const problem = toClaudeError(error);
      if (problem.problem === "notFound") {
        // Likely retired: the next question looks again, and Part 1's
        // stand-in note, or the list, takes it from there.
        this.models.stale();
      }
      throw toBrainError(problem);
    }
  }
}
