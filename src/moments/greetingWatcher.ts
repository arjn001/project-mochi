import * as vscode from "vscode";
import { cleanProjectName, shouldSaveCoding } from "./greeting";

// When she last typed in a file, and the project's folder name. Kept in
// Mochi's private global state on her computer; never a path, and nothing
// from her code.
export const LAST_CODING = "mochi.lastCoding";

// The project open in this window, by name: the folder's name, or the
// workspace's name when several folders are open.
export function projectName(): string | undefined {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return undefined;
  }
  return cleanProjectName(folders.length === 1 ? folders[0].name : vscode.workspace.name);
}

// Saves when she last coded, at most once a minute, not on every keystroke.
export function rememberCoding(state: vscode.Memento): vscode.Disposable {
  let lastSavedAt: number | undefined;
  return vscode.workspace.onDidChangeTextDocument((event) => {
    const typing = event.contentChanges.length > 0 && ["file", "untitled"].includes(event.document.uri.scheme);
    const now = Date.now();
    if (!typing || !shouldSaveCoding(lastSavedAt, now)) {
      return;
    }
    lastSavedAt = now;
    void state.update(LAST_CODING, { at: now, project: projectName() });
  });
}
