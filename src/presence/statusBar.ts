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

// Updates the mood line (see mood.ts for what wins). During a focus session,
// clicking it offers to stop the session instead of just opening Mochi.
export function showMood(
  item: vscode.StatusBarItem,
  speakUp: unknown,
  mood?: Mood,
  focusMinutesLeft?: number,
  breakMinutesLeft?: number
): void {
  const line = moodLine(speakUp, mood, focusMinutesLeft, breakMinutesLeft);
  item.text = line.text;
  item.tooltip = line.tooltip;
  item.accessibilityInformation = { label: line.label, role: "button" };
  item.command = focusMinutesLeft === undefined ? "mochi.open" : "mochi.focus.menu";
}
