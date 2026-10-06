import * as vscode from "vscode";

// Where the greeting shows. Its home is the panel (MOCHI-16), which will
// implement this same interface; until then it's a gentle notification
// with no buttons, which fades on its own.
export interface GreetingSurface {
  show(text: string): void;
}

export const notificationGreeting: GreetingSurface = {
  show: (text) => void vscode.window.showInformationMessage(text),
};
