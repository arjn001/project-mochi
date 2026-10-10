import * as vscode from "vscode";
import { shareStrings } from "../strings";
import { Answer, Ask } from "./shareGate";

// The share gate's question as a VS Code dialog. It's modal, so nothing is
// sent while she decides, and closing it counts as Cancel.
export const askToShare: Ask = async (question, about = "attachments"): Promise<Answer> => {
  if (about === "typedSecret") {
    const send = await vscode.window.showWarningMessage(question, { modal: true }, shareStrings.sendAnyway);
    return send === shareStrings.sendAnyway ? "share" : "cancel";
  }
  const share = "Share";
  const sendWithout = "Send without it";
  const choice = await vscode.window.showInformationMessage(
    question,
    { modal: true, detail: "Nothing leaves your computer unless you choose Share." },
    share,
    sendWithout
  );
  if (choice === share) {
    return "share";
  }
  if (choice === sendWithout) {
    return "sendWithout";
  }
  return "cancel";
};
