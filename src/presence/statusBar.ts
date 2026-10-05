import * as vscode from "vscode";

// Mochi's mood line on the right of the status bar. Always visible, and
// clicking it opens Mochi's tab. The mood is fixed for now; moods from the
// pack and the moments come later.
export function createMoodLine(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    "mochi.mood",
    vscode.StatusBarAlignment.Right,
    100
  );

  // Shown when someone right-clicks the status bar to hide items.
  item.name = "Mochi mood";
  item.text = "$(mochi-purring) Mochi is purring";
  item.tooltip = "Open Mochi";
  item.command = "mochi.open";
  // Read by screen readers instead of the icon and text.
  item.accessibilityInformation = {
    label: "Mochi is purring. Open Mochi.",
    role: "button",
  };

  item.show();
  return item;
}
