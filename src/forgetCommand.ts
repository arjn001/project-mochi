import * as vscode from "vscode";
import { Confirm, Forgettable, forgetEverything } from "./forget";
import { forgetStrings } from "./strings";

// A dialog, since this can't be undone. Only "Forget everything" is a yes;
// "Keep it", Escape, or closing it keeps everything.
const confirmInDialog: Confirm = async (question, detail, yes) => {
  const choice = await vscode.window.showWarningMessage(
    question,
    { modal: true, detail },
    { title: yes },
    { title: forgetStrings.keep, isCloseAffordance: true }
  );
  return choice?.title === yes;
};

// She asks for this herself, from the Command Palette.
export function registerForgetEverything(parts: Forgettable[]): vscode.Disposable {
  return vscode.commands.registerCommand("mochi.forgetEverything", async () => {
    const result = await forgetEverything(confirmInDialog, parts);
    if (result === "forgotten") {
      void vscode.window.showInformationMessage(forgetStrings.done);
    } else if (result === "partly") {
      const again = await vscode.window.showWarningMessage(forgetStrings.partly, forgetStrings.tryAgain);
      if (again === forgetStrings.tryAgain) {
        await vscode.commands.executeCommand("mochi.forgetEverything");
      }
    }
  });
}
