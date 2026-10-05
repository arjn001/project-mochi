import * as path from "node:path";
import * as vscode from "vscode";
import { NO_BRAIN, askMochi } from "./askMochi";
import { askToShare } from "./askToShare";
import { BrainError, Provider, brainProblemMessages } from "./provider";
import { Attachment } from "./shareGate";

// TEMPORARY: "Mochi: Ask" lets her talk to Mochi before the panel exists.
// The chat in the panel (MOCHI-21) replaces it.

// Basic instructions until the pack gives Mochi its personality (MOCHI-24).
const INSTRUCTIONS = "You are Mochi, a coding companion inside VS Code. Keep answers short and kind.";

// The code she has selected, if any, offered through the share gate.
function selectedCode(): Attachment[] {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    return [];
  }
  const doc = editor.document;
  // Only the file name, never the full path.
  const label = doc.isUntitled ? "an untitled file" : path.basename(doc.fileName);
  return [{ kind: "selection", label, text: doc.getText(editor.selection) }];
}

export function registerAskCommand(provider: Provider): vscode.Disposable {
  const output = vscode.window.createOutputChannel("Mochi");

  const command = vscode.commands.registerCommand("mochi.ask", async () => {
    const message = await vscode.window.showInputBox({
      prompt: "Ask Mochi anything",
      placeHolder: "What does this error mean?",
    });
    if (!message?.trim()) {
      return;
    }

    const controller = new AbortController();
    // Checks for a brain and passes the share gate. Nothing is sent yet.
    const result = await askMochi({ message, attachments: selectedCode() }, provider, INSTRUCTIONS, askToShare, controller.signal);

    if (result.status === "noBrain") {
      const setUp = "Set one up";
      if ((await vscode.window.showInformationMessage(NO_BRAIN, setUp)) === setUp) {
        // Until the welcome's "Pick a brain" exists (MOCHI-42).
        await vscode.commands.executeCommand("workbench.extensions.search", "@id:GitHub.copilot-chat");
      }
      return;
    }
    if (result.status === "notSent") {
      return;
    }

    output.show(true);
    output.appendLine(`You: ${message}`);
    output.append(`Mochi (${provider.name}): `);
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Mochi is thinking...", cancellable: true },
      async (_progress, token) => {
        token.onCancellationRequested(() => controller.abort());
        try {
          for await (const piece of result.text) {
            output.append(piece);
          }
        } catch (error) {
          const problem = error instanceof BrainError ? error.problem : "other";
          vscode.window.showWarningMessage(brainProblemMessages[problem]);
        }
        output.appendLine("\n");
      }
    );
  });

  return vscode.Disposable.from(command, output);
}
