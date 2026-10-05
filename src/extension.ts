import * as vscode from "vscode";
import { createMoodLine, showMood } from "./presence/statusBar";
import { onSpeakUpChange, readSpeakUp } from "./settings";

// What activate() hands back. The integration tests use it to see what the
// mood line says, since VS Code doesn't let tests read the status bar.
export interface MochiApi {
  moodText(): string;
}

// VS Code calls this once, after it finishes starting up.
export function activate(context: vscode.ExtensionContext): MochiApi {
  const sayHello = vscode.commands.registerCommand("mochi.sayHello", () => {
    vscode.window.showInformationMessage("Hello from Mochi!");
  });

  // Opens Mochi's tab in the secondary side bar, even if that bar is closed.
  const open = vscode.commands.registerCommand("mochi.open", () =>
    vscode.commands.executeCommand("workbench.view.extension.mochi")
  );

  // Mochi's home view is empty for now, so VS Code shows the welcome text
  // from package.json. The real panel replaces this in MOCHI-16.
  const home = vscode.window.registerTreeDataProvider("mochi.home", {
    getTreeItem: (item: vscode.TreeItem) => item,
    getChildren: () => [],
  });

  // The mood line follows the speak-up setting, and naps in quiet mode.
  const mood = createMoodLine();
  showMood(mood, readSpeakUp());
  const followSpeakUp = onSpeakUpChange((level) => showMood(mood, level));

  // Anything added here is cleaned up when Mochi shuts down.
  context.subscriptions.push(sayHello, open, home, mood, followSpeakUp);

  return { moodText: () => mood.text };
}

// VS Code calls this when Mochi shuts down. Nothing to clean up yet.
export function deactivate(): void {}
