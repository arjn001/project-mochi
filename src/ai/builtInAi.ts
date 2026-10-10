import * as vscode from "vscode";
import { compose } from "./compose";
import { BrainError, BrainProblem, Provider, SendOptions } from "./provider";
import { GatedRequest } from "./shareGate";

// One brain from VS Code's built-in AI: a Copilot model, or a model another
// extension provides. Which one is chosen in brainPicker.ts (MOCHI-53). The
// first request to a Copilot model shows VS Code's own one-time permission
// prompt, so it must only ever happen because she asked something.
export class ModelBrain implements Provider {
  constructor(
    private readonly model: vscode.LanguageModelChat,
    // How she sees it: "Copilot · Auto".
    readonly name: string
  ) {}

  get maxInputTokens(): number {
    return this.model.maxInputTokens;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async *send(request: GatedRequest, instructions: string, { history = [], signal }: SendOptions = {}): AsyncIterable<string> {
    const model = this.model;
    // VS Code has no "system" role, so Mochi's instructions go first, and a
    // short reply from the assistant marks where the conversation begins.
    const messages = [
      vscode.LanguageModelChatMessage.User(instructions),
      vscode.LanguageModelChatMessage.Assistant("Understood. I'll answer as described, and follow those rules."),
      ...history.map((turn) =>
        turn.from === "her" ? vscode.LanguageModelChatMessage.User(turn.text) : vscode.LanguageModelChatMessage.Assistant(turn.text)
      ),
      vscode.LanguageModelChatMessage.User(compose(request)),
    ];
    const cancel = new vscode.CancellationTokenSource();
    signal?.addEventListener("abort", () => cancel.cancel());
    try {
      const response = await model.sendRequest(
        messages,
        { justification: `Mochi uses ${this.name} to answer the questions you ask it.` },
        cancel.token
      );
      for await (const piece of response.text) {
        yield piece;
      }
    } catch (error) {
      throw toBrainError(error);
    } finally {
      cancel.dispose();
    }
  }
}

function toBrainError(error: unknown): BrainError {
  if (error instanceof BrainError) {
    return error;
  }
  if (error instanceof vscode.LanguageModelError) {
    const problems: Record<string, BrainProblem> = {
      [vscode.LanguageModelError.NoPermissions.name]: "noPermission",
      [vscode.LanguageModelError.Blocked.name]: "blocked",
      [vscode.LanguageModelError.NotFound.name]: "unavailable",
    };
    return new BrainError(problems[error.code] ?? "other", error.message);
  }
  return new BrainError("other", error instanceof Error ? error.message : String(error));
}
