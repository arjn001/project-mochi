import * as vscode from "vscode";
import { brainStrings, chatStrings } from "../strings";
import { AnswerSurface } from "./answerSurface";
import { BrainPicker, setUpABrain } from "./brainPicker";
import { NO_BRAIN, askMochi } from "./askMochi";
import { askToShare } from "./askToShare";
import { CONSOLE_BILLING } from "./claude";
import { Turn, historyBudget, recentTurns } from "./history";
import { BrainError, Provider, brainHelpButtons, brainProblemMessages } from "./provider";
import { GatedRequest, Request, describe, followUp } from "./shareGate";

// The chip after "I'd need a brain to answer that."
const SET_UP = "Set one up";

// Continues an answer from what was written so far (MOCHI-67).
type Again = (soFar: string, signal: AbortSignal) => AsyncIterable<string>;

// One place that asks a brain and shows the answer in the chat, used by
// the panel's box and by Explain. Handles no brain, refusals, the share
// gate, streaming, cancelling, and kind lines about problems, which appear
// in the chat with a chip when she can do something (MOCHI-21).
export class Conversation {
  // The brain that answered last, so a follow-up stays with it.
  private provider: Provider | undefined;
  // The answer being written, so she can stop it. One at a time.
  private running: { controller: AbortController; done: Promise<void> } | undefined;

  constructor(
    private readonly brains: Pick<BrainPicker, "forQuestion">,
    private readonly instructions: () => string,
    private readonly surface: AnswerSurface,
    // The chat so far, for the recent messages sent along (MOCHI-21).
    private readonly chat: () => Parameters<typeof recentTurns>[0] = () => []
  ) {}

  private history(provider: Provider | undefined): Turn[] {
    return recentTurns(this.chat(), historyBudget(provider?.maxInputTokens));
  }

  // Stops the answer being written, if there is one, keeping what's there
  // (MOCHI-25). Resolves once it has stopped.
  async stop(): Promise<void> {
    const running = this.running;
    if (running) {
      running.controller.abort();
      await running.done;
    }
  }

  // Asks through the share gate. Returns what was sent, so a follow-up can
  // reuse it without asking her again, or undefined if nothing was sent.
  // An answer still being written stops first, like when she clicks
  // "Explain with Mochi" while Mochi is answering.
  async ask(request: Request, heading: string): Promise<GatedRequest | undefined> {
    await this.stop();
    const brain = await this.brains.forQuestion();
    if (brain.kind === "waiting") {
      this.surface.say(brainStrings.waiting);
      return undefined;
    }
    const provider = brain.kind === "use" ? brain.provider : undefined;
    const controller = new AbortController();
    const history = this.history(provider);
    const result = await askMochi(request, provider, this.instructions(), askToShare, controller.signal, history);

    switch (result.status) {
      case "noBrain":
        // Not awaited: what she typed goes back in the box right away.
        void this.surface.problem(NO_BRAIN, SET_UP).then(async (clicked) => {
          if (clicked) {
            await setUpABrain();
          }
        });
        return undefined;
      case "refused":
        this.surface.say(result.reason);
        return undefined;
      case "notSent":
        return undefined;
      case "answer": {
        this.provider = provider;
        const sent = result.request;
        const again: Again = (soFar, signal) => provider!.send(sent, this.instructions(), { history, signal, soFar });
        // Under her message: what was shared with it, never the code.
        const shared = sent.attachments.length > 0 ? chatStrings.shared(sent.attachments.map(describe).join(" and ")) : undefined;
        await this.show(heading, result.text, controller, again, brain.kind === "use" ? brain.note : undefined, shared);
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
    await this.stop();
    const provider = this.provider;
    const asked = followUp(approved, message);
    const controller = new AbortController();
    // Includes the answer before, like the explanation a hint follows.
    const history = this.history(provider);
    const text = provider.send(asked, this.instructions(), { history, signal: controller.signal });
    const again: Again = (soFar, signal) => provider.send(asked, this.instructions(), { history, signal, soFar });
    await this.show(heading, text, controller, again);
  }

  // One kind line, with a chip when there's something she can do.
  private async showProblem(error: BrainError, keepGoing: () => Promise<void>): Promise<void> {
    const button = error.help && brainHelpButtons[error.help];
    if (!(await this.surface.problem(brainProblemMessages[error.problem], button))) {
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

  private async show(
    heading: string,
    text: AsyncIterable<string>,
    controller: AbortController,
    again: Again,
    // "Quick note: ..." when a stand-in brain answers, once per change.
    note?: string,
    shared?: string
  ): Promise<void> {
    this.surface.start(heading, shared);
    if (note) {
      this.surface.append(`${note}\n\n`);
    }
    await this.stream(text, controller, again, "");
  }

  // Shows the answer as it streams, in the chat only: the panel shows Stop
  // and paw prints while it's written (MOCHI-25). `before` is what this
  // answer already said, so "Keep going" can be offered again if it reaches
  // the limit twice.
  private async stream(text: AsyncIterable<string>, controller: AbortController, again: Again, before: string): Promise<void> {
    const done = this.write(text, controller, again, before);
    this.running = { controller, done };
    await done;
    if (this.running?.done === done) {
      this.running = undefined;
    }
  }

  private async write(text: AsyncIterable<string>, controller: AbortController, again: Again, before: string): Promise<void> {
    let written = before;
    try {
      for await (const piece of text) {
        written += piece;
        this.surface.append(piece);
      }
    } catch (error) {
      // Stopping can end a brain's answer with an error of its own.
      if (!controller.signal.aborted) {
        const problem = error instanceof BrainError ? error : new BrainError("other", String(error));
        const soFar = written;
        // Not awaited: her click on its chip comes later, if ever.
        void this.showProblem(problem, () => this.keepGoing(again, soFar));
      }
    }
    if (controller.signal.aborted) {
      this.surface.stopped();
    } else {
      this.surface.finish();
    }
  }

  // "Keep going": the same brain and the same approved request, picking up
  // from the answer so far. Nothing new is shared, so no share gate.
  private async keepGoing(again: Again, soFar: string): Promise<void> {
    await this.stop();
    const controller = new AbortController();
    this.surface.resume();
    await this.stream(again(soFar, controller.signal), controller, again, soFar);
  }
}
