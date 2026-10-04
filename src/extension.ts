import * as vscode from "vscode";

// VS Code calls this once, the first time Mochi is needed.
export function activate(context: vscode.ExtensionContext): void {
  const sayHello = vscode.commands.registerCommand("mochi.sayHello", () => {
    vscode.window.showInformationMessage("Hello from Mochi!");
  });

  // Anything added here is cleaned up when Mochi shuts down.
  context.subscriptions.push(sayHello);
}

// VS Code calls this when Mochi shuts down. Nothing to clean up yet.
export function deactivate(): void {}
