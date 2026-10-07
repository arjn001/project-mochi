import * as path from "node:path";
import * as vscode from "vscode";
import { isMochiError } from "../diagnostics";
import { AnswerSurface } from "./answerSurface";
import { Conversation } from "./conversation";
import { CodeError, Step, errorRequest, nextSteps, selectionRequest, stepMessage } from "./explain";

const fileLabel = (doc: vscode.TextDocument) => (doc.isUntitled ? "an untitled file" : path.basename(doc.fileName));

// Errors, plus warnings that crash when the code runs (MOCHI-66).
const isError = isMochiError;

// "Explain with Mochi" in the lightbulb next to an error.
class ExplainCodeActions implements vscode.CodeActionProvider {
  static readonly kinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(doc: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext) {
    const error = context.diagnostics.find(isError);
    if (!error) {
      return [];
    }
    const action = new vscode.CodeAction("Explain with Mochi", vscode.CodeActionKind.QuickFix);
    action.command = {
      command: "mochi.explainError",
      title: "Explain with Mochi",
      arguments: [doc.uri, error.range.start.line, error.message],
    };
    return [action];
  }
}

// The error under the cursor, or the first one in the file.
function errorInEditor(editor: vscode.TextEditor): vscode.Diagnostic | undefined {
  const errors = vscode.languages.getDiagnostics(editor.document.uri).filter(isError);
  return errors.find((d) => d.range.contains(editor.selection.active)) ?? errors[0];
}

async function explainError(conversation: Conversation, surface: AnswerSurface, error: CodeError): Promise<void> {
  const heading = `Explaining the error on line ${error.line} of ${error.file}`;
  const approved = await conversation.ask(errorRequest("explain", error), heading);
  if (!approved) {
    return;
  }
  // The ladder: each step only when she picks it, never skipping ahead.
  let step: Step = "explain";
  for (let next = nextSteps(step); next; next = nextSteps(step)) {
    const pick = await surface.offerNext(next.prompt, next.choices.map((c) => c.label));
    const choice = next.choices.find((c) => c.label === pick);
    if (!choice) {
      return;
    }
    step = choice.step;
    await conversation.followUp(approved, stepMessage(step), `${choice.label}: line ${error.line} of ${error.file}`);
  }
}

export function registerExplain(conversation: Conversation, surface: AnswerSurface): vscode.Disposable {
  const lightbulb = vscode.languages.registerCodeActionsProvider(
    [{ scheme: "file" }, { scheme: "untitled" }],
    new ExplainCodeActions(),
    { providedCodeActionKinds: ExplainCodeActions.kinds }
  );

  const onError = vscode.commands.registerCommand(
    "mochi.explainError",
    // `uri` is a string when it comes from a hover link ("Need a paw?").
    async (uri?: vscode.Uri | string, line?: number, message?: string) => {
      const target = uri?.toString();
      let doc = target ? vscode.workspace.textDocuments.find((d) => d.uri.toString() === target) : undefined;
      if (!doc || line === undefined || message === undefined) {
        const editor = vscode.window.activeTextEditor;
        const error = editor && errorInEditor(editor);
        if (!editor || !error) {
          vscode.window.showInformationMessage("No errors here to explain. Select some code and I'll explain that instead.");
          return;
        }
        doc = editor.document;
        line = error.range.start.line;
        message = error.message;
      }
      const lines = doc.getText().split(/\r?\n/);
      await explainError(conversation, surface, { message, file: fileLabel(doc), lines, line: line + 1 });
    }
  );

  const onSelection = vscode.commands.registerCommand("mochi.explainSelection", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showInformationMessage("Select some code first, and I'll explain it.");
      return;
    }
    const file = fileLabel(editor.document);
    await conversation.ask(selectionRequest(file, editor.document.getText(editor.selection)), `Explaining the selected code from ${file}`);
  });

  return vscode.Disposable.from(lightbulb, onError, onSelection);
}
