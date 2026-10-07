import * as vscode from "vscode";
import { brainStrings } from "../strings";
import { AnswerSurface } from "./answerSurface";
import { BrainPicker, signInToCopilot } from "./brainPicker";
import { NO_BRAIN, askMochi } from "./askMochi";
import { askToShare } from "./askToShare";
import { BrainError, Provider, brainProblemMessages } from "./provider";
import { GatedRequest, Request, followUp } from "./shareGate";

// One place that asks a brain and shows the answer, used by "Mochi: Ask"
// and by Explain. Handles no brain, refusals, the share gate, streaming,
// cancelling, and kind error messages.
export class Conversation {
  // The brain that answered last, so a follow-up stays with it.
  private provider: Provider | undefined;

  constructor(
    private readonly brains: Pick<BrainPicker, "forQuestion">,
    private readonly instructions: () => string,
    private readonly surface: AnswerSurface
  ) {}

  // Asks through the share gate. Returns what was sent, so a follow-up can
  // reuse it without asking her again, or undefined if nothing was sent.
  async ask(request: Request, heading: string): Promise<GatedRequest | undefined> {
    const brain = await this.brains.forQuestion();
    if (brain.kind === "waiting") {
      this.say(heading, brainStrings.waiting);
      return undefined;
    }
    const provider = brain.kind === "use" ? brain.provider : undefined;
    const controller = new AbortController();
    const result = await askMochi(request, provider, this.instructions(), askToShare, controller.signal);

    switch (result.status) {
      case "noBrain": {
        const setUp = "Set one up";
        if ((await vscode.window.showInformationMessage(NO_BRAIN, setUp)) === setUp) {
          await signInToCopilot();
        }
        return undefined;
      }
      case "refused":
        vscode.window.showInformationMessage(result.reason);
        return undefined;
      case "notSent":
        return undefined;
      case "answer":
        this.provider = provider;
        await this.show(heading, result.text, controller, brain.kind === "use" ? brain.note : undefined);
        if (brain.kind === "use") {
          await brain.noted?.();
        }
        return result.request;
    }
  }

  // Asks again about exactly what she already agreed to share.
  async followUp(approved: GatedRequest, message: string, heading: string): Promise<void> {
    if (!this.provider) {
      return;
    }
    const controller = new AbortController();
    const text = this.provider.send(followUp(approved, message), this.instructions(), controller.signal);
    await this.show(heading, text, controller);
  }

  // One line from Mochi, with no brain involved.
  private say(heading: string, line: string): void {
    this.surface.start(heading, "Mochi");
    this.surface.append(line);
    this.surface.finish();
  }

  private async show(
    heading: string,
    text: AsyncIterable<string>,
    controller: AbortController,
    // "Quick note: ..." when a stand-in brain answers, once per change.
    note?: string
  ): Promise<void> {
    this.surface.start(heading, `Mochi (${this.provider?.name ?? "Mochi"})`);
    if (note) {
      this.surface.append(`${note}\n\n`);
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Mochi is thinking...", cancellable: true },
      async (_progress, token) => {
        token.onCancellationRequested(() => controller.abort());
        try {
          for await (const piece of text) {
            this.surface.append(piece);
          }
        } catch (error) {
          const problem = error instanceof BrainError ? error.problem : "other";
          vscode.window.showWarningMessage(brainProblemMessages[problem]);
        }
        this.surface.finish();
      }
    );
  }
}
