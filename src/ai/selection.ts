import * as path from "node:path";
import * as vscode from "vscode";
import { Attachment } from "./shareGate";

// The code she has selected, if any, offered through the share gate when
// she sends a message from the panel.
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
