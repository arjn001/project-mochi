import * as vscode from "vscode";

// VS Code calls this once, the first time Mochi is needed.
export function activate(context: vscode.ExtensionContext): void {
  const sayHello = vscode.commands.registerCommand("mochi.sayHello", () => {
    vscode.window.showInformationMessage("Hello from Mochi!");
  });

  // Mochi's home view is empty for now, so VS Code shows the welcome text
  // from package.json. The real panel replaces this in MOCHI-16.
  const home = vscode.window.registerTreeDataProvider("mochi.home", {
    getTreeItem: (item: vscode.TreeItem) => item,
    getChildren: () => [],
  });

  // Anything added here is cleaned up when Mochi shuts down.
  context.subscriptions.push(sayHello, home);
}

// VS Code calls this when Mochi shuts down. Nothing to clean up yet.
export function deactivate(): void {}
