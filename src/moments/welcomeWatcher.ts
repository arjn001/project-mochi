import * as vscode from "vscode";
import { BrainCheck, welcomeDue, welcomeText, wasWelcomed } from "./welcome";
import { LAST_CODING, LAST_GREETED } from "./greetingWatcher";
import { nightOf } from "./lateNight";
import { Pack } from "../packs/format";
import { readSpeakUp } from "../settings";
import { welcomeStrings } from "../strings";

// Whether she's been welcomed, shared by all her windows. Not cleared by
// "Forget everything": the welcome is about installing Mochi, not her days.
export const WELCOMED = "mochi.welcomed";

// The first-run welcome (MOCHI-42): opens Mochi's tab once, then one gentle
// notification with a greeting, where Mochi lives, and the brain check. On
// that day it takes the greeting's place; never both.
export class Welcomer {
  constructor(
    private readonly state: vscode.Memento,
    private readonly pack: () => Pack,
    private readonly isFocusing: () => boolean,
    private readonly checkBrain: () => Promise<BrainCheck>,
    private readonly setUpCopilot: () => Promise<void>
  ) {}

  // Welcomes if it's her first time, and returns what Mochi said.
  async welcome(): Promise<string | undefined> {
    try {
      const hasGreetingMemory = this.state.get(LAST_GREETED) !== undefined || this.state.get(LAST_CODING) !== undefined;
      const welcomed = wasWelcomed(this.state.get(WELCOMED), hasGreetingMemory);
      if (!welcomeDue(welcomed, readSpeakUp(), this.isFocusing())) {
        // Remembered either way, so someone who used Mochi before the
        // welcome existed is never welcomed as new later.
        await this.state.update(WELCOMED, welcomed);
        return undefined;
      }
      // Saved before showing, so another window won't welcome her too, and
      // won't greet her today either.
      await this.state.update(WELCOMED, true);
      await this.state.update(LAST_GREETED, nightOf(new Date()));
      await vscode.commands.executeCommand("mochi.open");
      const { text, button } = welcomeText(this.pack().name, await this.checkBrain());
      void this.show(text, button);
      return text;
    } catch {
      // A welcome is a nicety Mochi starts on its own, so a problem stays
      // quiet instead of showing an error.
      return undefined;
    }
  }

  private async show(text: string, button: "setUpCopilot" | "chooseBrain" | undefined): Promise<void> {
    if (!button) {
      await vscode.window.showInformationMessage(text);
      return;
    }
    const label = button === "setUpCopilot" ? welcomeStrings.setUpCopilot : welcomeStrings.chooseBrain;
    if ((await vscode.window.showInformationMessage(text, label)) !== label) {
      return;
    }
    if (button === "setUpCopilot") {
      await this.setUpCopilot();
    } else {
      await vscode.commands.executeCommand("mochi.chooseBrain");
    }
  }
}
