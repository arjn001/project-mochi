import * as vscode from "vscode";
import { toFocusMinutes } from "./focus/timer";
import { SpeakUp, toSpeakUp } from "./moments/gatekeeper";
import { toLearningMode } from "./ai/instructions";
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

// Learning mode (MOCHI-64). On unless she turned it off herself; it's an
// application setting, so a project's settings can't change it.
export function readLearningMode(): boolean {
  return toLearningMode(vscode.workspace.getConfiguration("mochi").get("learningMode"));
}

// Calls back with the new level whenever she changes it, with no reload.
export function onSpeakUpChange(callback: (level: SpeakUp) => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("mochi.speakUp")) {
      callback(readSpeakUp());
    }
  });
}
