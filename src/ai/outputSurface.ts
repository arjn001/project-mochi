import * as vscode from "vscode";
import { AnswerSurface } from "./answerSurface";

// TEMPORARY: answers in the "Mochi" output panel until the panel chat
// (MOCHI-21) exists. It opens without taking focus, so she can keep typing.
export function createOutputSurface(): AnswerSurface & vscode.Disposable {
  const output = vscode.window.createOutputChannel("Mochi");
  return {
    start(heading, speaker) {
      output.show(true);
      output.appendLine(heading);
      output.append(`${speaker}: `);
    },
    append(text) {
      output.append(text);
    },
    finish() {
      output.appendLine("\n");
    },
    // The output panel can't take back the blank line after an answer, so
    // the rest continues just below it.
    resume() {
      output.show(true);
    },
    offerNext(prompt, choices) {
      return Promise.resolve(vscode.window.showInformationMessage(prompt, ...choices));
    },
    dispose() {
      output.dispose();
    },
  };
}
