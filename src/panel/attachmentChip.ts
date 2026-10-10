import * as vscode from "vscode";
import { selectedCode } from "../ai/selection";
import { Attachment, chipLabel } from "../ai/shareGate";
import { chatStrings } from "../strings";

// How long the selection has to settle before the chip follows it, so
// dragging across lines doesn't redraw the panel at every step.
const SETTLE_MS = 150;

// Which selection this is: the file and the exact range.
const selectionKey = (editor: vscode.TextEditor) => `${editor.document.uri.toString()}#${editor.selection.start.line}:${editor.selection.start.character}-${editor.selection.end.line}:${editor.selection.end.character}`;

// The chip above the box while she has code selected (MOCHI-21):
// "homework.py, lines 9 to 15", with an x to leave it out. The share gate
// still asks when she sends. Leaving it out lasts until she selects
// something else.
export class AttachmentChip implements vscode.Disposable {
  private leftOut: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners: vscode.Disposable[];

  constructor(private readonly changed: () => void) {
    const follow = () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(changed, SETTLE_MS);
    };
    this.listeners = [vscode.window.onDidChangeTextEditorSelection(follow), vscode.window.onDidChangeActiveTextEditor(follow)];
  }

  // What would be attached if she sent now.
  attached(): Attachment[] {
    const editor = vscode.window.activeTextEditor;
    const selected = selectedCode(editor);
    return selected && editor && selectionKey(editor) !== this.leftOut ? [selected] : [];
  }

  // What the panel shows above the box, if anything.
  shown(): { label: string; leaveOut: string } | undefined {
    const [selected] = this.attached();
    if (selected?.kind !== "selection") {
      return undefined;
    }
    const label = chipLabel(selected);
    return { label, leaveOut: chatStrings.leaveOut(label) };
  }

  // Her click on the x.
  leaveOut(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      this.leftOut = selectionKey(editor);
      this.changed();
    }
  }

  dispose(): void {
    clearTimeout(this.timer);
    for (const listener of this.listeners) {
      listener.dispose();
    }
  }
}
