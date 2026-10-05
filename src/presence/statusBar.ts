import * as vscode from "vscode";
import { Mood, moodLine } from "./mood";

// Mochi's mood line on the right of the status bar. Always visible, and
// clicking it opens Mochi's tab.
export function createMoodLine(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    "mochi.mood",
    vscode.StatusBarAlignment.Right,
    100
  );

  // Shown when someone right-clicks the status bar to hide items.
  item.name = "Mochi mood";
  item.command = "mochi.open";
  item.show();
  return item;
}

// Updates the mood line. In quiet mode it always naps (see mood.ts).
export function showMood(item: vscode.StatusBarItem, speakUp: unknown, mood?: Mood): void {
  const line = moodLine(speakUp, mood);
  item.text = line.text;
  item.tooltip = line.tooltip;
  item.accessibilityInformation = { label: line.label, role: "button" };
}
