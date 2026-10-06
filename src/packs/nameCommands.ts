import * as vscode from "vscode";
import { personalStrings } from "../strings";
import { PersonalLayer, nameProblem } from "./personalLayer";

// She asks for these herself, so nothing is confirmed again. Her name stays
// on her computer, in her personal layer, and is never sent to the AI.
export function registerNameCommands(personal: PersonalLayer): vscode.Disposable {
  const ask = vscode.commands.registerCommand("mochi.setName", async () => {
    const value = await vscode.window.showInputBox({
      prompt: personalStrings.askName,
      placeHolder: personalStrings.askNamePlaceholder,
      value: personal.name(),
      validateInput: nameProblem,
    });
    if (value === undefined) {
      return;
    }
    if ((await personal.setName(value)).ok) {
      void vscode.window.showInformationMessage(personalStrings.niceToMeet(value.trim()));
    }
  });

  const forget = vscode.commands.registerCommand("mochi.forgetName", async () => {
    const forgot = await personal.forgetName();
    void vscode.window.showInformationMessage(forgot ? personalStrings.forgotName : personalStrings.noNameYet);
  });

  return vscode.Disposable.from(ask, forget);
}
