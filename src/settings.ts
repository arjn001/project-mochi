import * as vscode from "vscode";
import { toFocusMinutes } from "./focus/timer";
import { SpeakUp, toSpeakUp } from "./moments/gatekeeper";
import { toLateHour } from "./moments/lateNight";

// The speak-up level for the open project. A project's own setting wins over
// the user setting; anything unexpected counts as gentle.
export function readSpeakUp(): SpeakUp {
  return toSpeakUp(vscode.workspace.getConfiguration("mochi").get("speakUp"));
}

// How long a focus session lasts, in minutes. Anything unexpected is 25.
export function readFocusMinutes(): number {
  return toFocusMinutes(vscode.workspace.getConfiguration("mochi").get("focusMinutes"));
}

// The hour late night starts. Anything unexpected is 23:00.
export function readLateHour(): number {
  return toLateHour(vscode.workspace.getConfiguration("mochi").get("lateHour"));
}

// Calls back with the new level whenever she changes it, with no reload.
export function onSpeakUpChange(callback: (level: SpeakUp) => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("mochi.speakUp")) {
      callback(readSpeakUp());
    }
  });
}
