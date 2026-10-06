import * as path from "node:path";
import * as vscode from "vscode";
import { readSpeakUp } from "../settings";
import { errorKey, stuckOn, track } from "./stuck";

// Everything here lives in memory for this VS Code session only. Nothing
// about her code is saved to disk (see DECISIONS.md).
export function watchStuck(): vscode.Disposable {
  // Plain text, no emoji, since emoji look different on every system.
  const hint = vscode.window.createTextEditorDecorationType({
    after: {
      contentText: "Need a paw?",
      color: new vscode.ThemeColor("editorCodeLens.foreground"),
      fontStyle: "italic",
      margin: "0 0 0 2em",
    },
  });

  let tracked = new Map<string, number>();
  const offered = new Set<string>();
  const lastEdit = new Map<string, number>();
  // Hints showing now, per file: error key, line, and message.
  const showing = new Map<string, { key: string; line: number; message: string }[]>();

  const errorsIn = (doc: vscode.TextDocument) => {
    const lines = doc.getText().split(/\r?\n/);
    const file = doc.isUntitled ? doc.uri.toString() : path.basename(doc.fileName);
    return vscode.languages
      .getDiagnostics(doc.uri)
      .filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
      .map((d) => ({ key: errorKey(file, d.message, lines, d.range.start.line), line: d.range.start.line, message: d.message }));
  };

  const draw = (editor: vscode.TextEditor) => {
    const uri = editor.document.uri.toString();
    const current = new Map(errorsIn(editor.document).map((e) => [e.key, e]));
    // A hint goes away once its error is fixed, and follows it if it moves.
    const hints = (showing.get(uri) ?? []).filter((h) => current.has(h.key)).map((h) => current.get(h.key)!);
    showing.set(uri, hints);
    editor.setDecorations(
      hint,
      hints.map((h) => {
        const link = new vscode.MarkdownString(
          `[Explain with Mochi](command:mochi.explainError?${encodeURIComponent(JSON.stringify([editor.document.uri.toString(), h.line, h.message]))})`
        );
        link.isTrusted = { enabledCommands: ["mochi.explainError"] };
        return { range: editor.document.lineAt(h.line).range, hoverMessage: link };
      })
    );
  };

  const check = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !["file", "untitled"].includes(editor.document.uri.scheme)) {
      return;
    }
    const uri = editor.document.uri.toString();
    const errors = errorsIn(editor.document);
    const now = Date.now();
    tracked = track(tracked, errors.map((e) => e.key), now);
    const due = stuckOn({ now, lastEditAt: lastEdit.get(uri), speakUp: readSpeakUp(), tracked, offered });
    for (const key of due) {
      offered.add(key);
      const error = errors.find((e) => e.key === key)!;
      showing.set(uri, [...(showing.get(uri) ?? []), error]);
    }
    draw(editor);
  };

  const typing = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.contentChanges.length > 0 && event.document === vscode.window.activeTextEditor?.document) {
      lastEdit.set(event.document.uri.toString(), Date.now());
    }
  });
  const errorsChanged = vscode.languages.onDidChangeDiagnostics(check);
  const switched = vscode.window.onDidChangeActiveTextEditor(check);
  // Errors that just sit there don't fire events, so check every 15 seconds.
  const tick = setInterval(check, 15_000);

  return vscode.Disposable.from(hint, typing, errorsChanged, switched, { dispose: () => clearInterval(tick) });
}
