import * as path from "node:path";
import * as vscode from "vscode";
import { Conversation } from "./conversation";
import { Attachment } from "./shareGate";

// TEMPORARY: "Mochi: Ask" lets her talk to Mochi before the panel exists.
// The chat in the panel (MOCHI-21) replaces it.

// The code she has selected, if any, offered through the share gate.
export function selectedCode(): Attachment[] {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    return [];
  }
  const doc = editor.document;
  // Only the file name, never the full path.
  const label = doc.isUntitled ? "an untitled file" : path.basename(doc.fileName);
  return [{ kind: "selection", label, text: doc.getText(editor.selection) }];
}

export function registerAskCommand(conversation: Conversation): vscode.Disposable {
  return vscode.commands.registerCommand("mochi.ask", async () => {
    const message = await vscode.window.showInputBox({
      prompt: "Ask Mochi anything",
      placeHolder: "What does this error mean?",
    });
    if (message?.trim()) {
      await conversation.ask({ message, attachments: selectedCode() }, `You: ${message}`);
    }
  });
}
