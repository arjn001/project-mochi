import * as vscode from "vscode";
import { readFocusMinutes } from "../settings";
import { celebrateStrings } from "../strings";
import { FocusTimer } from "./timer";

// She starts these herself, so nothing here asks for confirmation (see
// PRESENCE.md: Mochi confirms before doing anything she didn't directly ask
// for). Time's up always tells her, even in quiet mode, since she started it.
export function registerFocus(timer: FocusTimer, refreshMood: () => void): vscode.Disposable {
  let tick: NodeJS.Timeout | undefined;

  timer.onChange(() => {
    // Shows "Start" or "Stop" in the Command Palette as fits.
    void vscode.commands.executeCommand("setContext", "mochi.focusing", timer.isRunning());
    refreshMood();
    clearInterval(tick);
    // Minutes only, so checking a few times a minute is plenty.
    tick = timer.isTicking() ? setInterval(refreshMood, 15_000) : undefined;
  });

  timer.onEnd(async (kind) => {
    // A break she took after finishing something (MOCHI-36). She started
    // it, so it tells her even in quiet mode.
    if (kind === "break") {
      void vscode.window.showInformationMessage(celebrateStrings.breakOver);
      return;
    }
    const again = "Another round";
    const choice = await vscode.window.showInformationMessage(
      "Time's up! That was some focused work. Stretch break?",
      again,
      "Done"
    );
    if (choice === again) {
      await timer.start(readFocusMinutes());
    }
  });

  const start = vscode.commands.registerCommand("mochi.focus", async () => {
    if (timer.isRunning()) {
      vscode.window.showInformationMessage(`You're already focusing. ${timer.minutesLeft()} min left.`);
      return;
    }
    await timer.start(readFocusMinutes());
  });

  const stop = vscode.commands.registerCommand("mochi.focus.stop", () => timer.stop());

  // What clicking the mood line does during a session.
  const menu = vscode.commands.registerCommand("mochi.focus.menu", async () => {
    const stopIt = "Stop the focus session";
    const open = "Open Mochi";
    const choice = await vscode.window.showQuickPick([stopIt, open], {
      placeHolder: `Focusing, ${timer.minutesLeft()} min left`,
    });
    if (choice === stopIt) {
      await timer.stop();
    } else if (choice === open) {
      await vscode.commands.executeCommand("mochi.open");
    }
  });

  return vscode.Disposable.from(start, stop, menu, { dispose: () => clearInterval(tick) });
}
