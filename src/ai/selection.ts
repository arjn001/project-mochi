import * as path from "node:path";
import * as vscode from "vscode";
import { Attachment } from "./shareGate";

// The code she has selected, if any, offered through the share gate when
// she sends a message from the panel. Only the main selection.
export function selectedCode(editor = vscode.window.activeTextEditor): (Attachment & { kind: "selection" }) | undefined {
  if (!editor || editor.selection.isEmpty) {
    return undefined;
  }
  const doc = editor.document;
  const { start, end } = editor.selection;
  // A selection that ends at the very start of a line doesn't include it.
  const last = end.character === 0 && end.line > start.line ? end.line - 1 : end.line;
  return {
    kind: "selection",
    // Only the file name, never the full path.
    label: doc.isUntitled ? "an untitled file" : path.basename(doc.fileName),
    text: doc.getText(editor.selection),
    from: start.line + 1,
    to: last + 1,
  };
}
