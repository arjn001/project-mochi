import * as vscode from "vscode";
import { dialogAsk } from "./shareDialog";

// The share gate's question as VS Code dialogs. They're modal, so nothing
// is sent while she decides, and closing one counts as Cancel. What each
// click means is in shareDialog.ts.
export const askToShare = dialogAsk({
  warning: (question, buttons) => vscode.window.showWarningMessage(question, { modal: true }, ...buttons),
  information: (question, detail, buttons) => vscode.window.showInformationMessage(question, { modal: true, detail }, ...buttons),
});
