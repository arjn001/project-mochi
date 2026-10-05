import * as vscode from "vscode";
import { choose } from "../actions/choose";
import { offer } from "../actions/confirm";
import { currentThemeKind, dimAction } from "../actions/theme";
import { FocusTimer } from "../focus/timer";
import { Pack } from "../packs/format";
import { pickPhrase } from "../packs/phrases";
import { readLateHour, readSpeakUp } from "../settings";
import { lateNightNudge, nightOf } from "./lateNight";

// Shared by every VS Code window, so several windows still give ONE nudge.
const LAST_NUDGED = "mochi.lastNudgedNight";

// Checked when she types, so the nudge only comes while she's coding, and
// at most once a minute.
export function watchLateNight(pack: Pack, timer: FocusTimer, state: vscode.Memento): vscode.Disposable {
  let lastCheck = 0;

  return vscode.workspace.onDidChangeTextDocument((event) => {
    const typing =
      event.contentChanges.length > 0 &&
      ["file", "untitled"].includes(event.document.uri.scheme) &&
      vscode.window.state.focused;
    if (!typing || Date.now() - lastCheck < 60_000) {
      return;
    }
    lastCheck = Date.now();
    void check(new Date(), pack, timer, state);
  });
}

async function check(now: Date, pack: Pack, timer: FocusTimer, state: vscode.Memento): Promise<void> {
  const nudge = lateNightNudge({
    now,
    lateHour: readLateHour(),
    speakUp: readSpeakUp(),
    lastNudgedNight: state.get<string>(LAST_NUDGED),
    focusing: timer.isRunning(),
    theme: currentThemeKind(),
  });
  if (!nudge) {
    return;
  }
  // Saved before showing anything, so another window won't nudge too.
  await state.update(LAST_NUDGED, nightOf(now));

  if (nudge === "dim") {
    await offer(dimAction(pickPhrase(pack, "lateNight")), choose);
  } else {
    await vscode.window.showInformationMessage(pickPhrase(pack, "lateNightCompany"));
  }
}
