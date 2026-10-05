import * as vscode from "vscode";
import { SpeakUp, toSpeakUp } from "./moments/gatekeeper";

// The speak-up level for the open project. A project's own setting wins over
// the user setting; anything unexpected counts as gentle.
export function readSpeakUp(): SpeakUp {
  return toSpeakUp(vscode.workspace.getConfiguration("mochi").get("speakUp"));
}

// Calls back with the new level whenever she changes it, with no reload.
export function onSpeakUpChange(callback: (level: SpeakUp) => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("mochi.speakUp")) {
      callback(readSpeakUp());
    }
  });
}
