import * as vscode from "vscode";
import { brainStrings } from "../strings";
import { AnswerSurface } from "./answerSurface";
import { BrainPicker, setUpABrain } from "./brainPicker";
import { NO_BRAIN, askMochi } from "./askMochi";
import { askToShare } from "./askToShare";
import { CONSOLE_BILLING } from "./claude";
import { BrainError, Provider, brainHelpButtons, brainProblemMessages } from "./provider";
import { GatedRequest, Request, followUp } from "./shareGate";

// Continues an answer from what was written so far (MOCHI-67).
type Again = (soFar: string, signal: AbortSignal) => AsyncIterable<string>;

// One kind line, with a button when there's something she can do. An
// answer that reached the length limit isn't a problem, so it's a gentle
// note, not a warning.
async function showProblem(error: BrainError, keepGoing: () => Promise<void>): Promise<void> {
  const message = brainProblemMessages[error.problem];
  const show = error.problem === "cutOff" ? vscode.window.showInformationMessage : vscode.window.showWarningMessage;
  if (!error.help) {
    await show(message);
    return;
  }
  const button = brainHelpButtons[error.help];
  if ((await show(message, button)) !== button) {
    return;
  }
  if (error.help === "addClaudeKey") {
    await vscode.commands.executeCommand("mochi.addClaudeKey");
  } else if (error.help === "keepGoing") {
    await keepGoing();
  } else {
    await vscode.env.openExternal(vscode.Uri.parse(CONSOLE_BILLING));
  }
}

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
          await setUpABrain();
        }
        return undefined;
      }
      case "refused":
        vscode.window.showInformationMessage(result.reason);
        return undefined;
      case "notSent":
        return undefined;
      case "answer": {
        this.provider = provider;
        const sent = result.request;
        const again: Again = (soFar, signal) => provider!.send(sent, this.instructions(), signal, soFar);
        await this.show(heading, result.text, controller, again, brain.kind === "use" ? brain.note : undefined);
        if (brain.kind === "use") {
          await brain.noted?.();
        }
        return result.request;
      }
    }
  }

  // Asks again about exactly what she already agreed to share.
  async followUp(approved: GatedRequest, message: string, heading: string): Promise<void> {
    if (!this.provider) {
      return;
    }
    const provider = this.provider;
    const asked = followUp(approved, message);
    const controller = new AbortController();
    const text = provider.send(asked, this.instructions(), controller.signal);
    const again: Again = (soFar, signal) => provider.send(asked, this.instructions(), signal, soFar);
    await this.show(heading, text, controller, again);
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
    again: Again,
    // "Quick note: ..." when a stand-in brain answers, once per change.
    note?: string
  ): Promise<void> {
    this.surface.start(heading, `Mochi (${this.provider?.name ?? "Mochi"})`);
    if (note) {
      this.surface.append(`${note}\n\n`);
    }
    await this.stream(text, controller, again, "");
  }

  // Shows the answer as it streams. `before` is what this answer already
  // said, so "Keep going" can be offered again if it reaches the limit
  // twice.
  private async stream(text: AsyncIterable<string>, controller: AbortController, again: Again, before: string): Promise<void> {
    let written = before;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Mochi is thinking...", cancellable: true },
      async (_progress, token) => {
        token.onCancellationRequested(() => controller.abort());
        try {
          for await (const piece of text) {
            written += piece;
            this.surface.append(piece);
          }
        } catch (error) {
          const problem = error instanceof BrainError ? error : new BrainError("other", String(error));
          const soFar = written;
          // Not awaited, so "Mochi is thinking..." closes right away.
          void showProblem(problem, () => this.keepGoing(again, soFar));
        }
        this.surface.finish();
      }
    );
  }

  // "Keep going": the same brain and the same approved request, picking up
  // from the answer so far. Nothing new is shared, so no share gate.
  private async keepGoing(again: Again, soFar: string): Promise<void> {
    const controller = new AbortController();
    this.surface.resume();
    await this.stream(again(soFar, controller.signal), controller, again, soFar);
  }
}
