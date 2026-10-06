import * as vscode from "vscode";
import { AnswerSurface } from "./answerSurface";
import { NO_BRAIN, askMochi } from "./askMochi";
import { askToShare } from "./askToShare";
import { BrainError, Provider, brainProblemMessages } from "./provider";
import { GatedRequest, Request, followUp } from "./shareGate";

// One place that asks a brain and shows the answer, used by "Mochi: Ask"
// and by Explain. Handles no brain, refusals, the share gate, streaming,
// cancelling, and kind error messages.
export class Conversation {
  constructor(
    private readonly provider: Provider,
    private readonly instructions: () => string,
    private readonly surface: AnswerSurface
  ) {}

  // Asks through the share gate. Returns what was sent, so a follow-up can
  // reuse it without asking her again, or undefined if nothing was sent.
  async ask(request: Request, heading: string): Promise<GatedRequest | undefined> {
    const controller = new AbortController();
    const result = await askMochi(request, this.provider, this.instructions(), askToShare, controller.signal);

    switch (result.status) {
      case "noBrain": {
        const setUp = "Set one up";
        if ((await vscode.window.showInformationMessage(NO_BRAIN, setUp)) === setUp) {
          await setUpCopilot();
        }
        return undefined;
      }
      case "refused":
        vscode.window.showInformationMessage(result.reason);
        return undefined;
      case "notSent":
        return undefined;
      case "answer":
        await this.show(heading, result.text, controller);
        return result.request;
    }
  }

  // Asks again about exactly what she already agreed to share.
  async followUp(approved: GatedRequest, message: string, heading: string): Promise<void> {
    const controller = new AbortController();
    const text = this.provider.send(followUp(approved, message), this.instructions(), controller.signal);
    await this.show(heading, text, controller);
  }

  private async show(heading: string, text: AsyncIterable<string>, controller: AbortController): Promise<void> {
    this.surface.start(heading, `Mochi (${this.provider.name})`);
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

// Opens VS Code's own Copilot setup ("Use AI Features with Copilot for
// free..."). Until the welcome's "Pick a brain" exists (MOCHI-42).
async function setUpCopilot(): Promise<void> {
  try {
    await vscode.commands.executeCommand("workbench.action.chat.triggerSetup");
  } catch {
    await vscode.commands.executeCommand("workbench.action.chat.open");
  }
}
