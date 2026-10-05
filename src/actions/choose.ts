import * as vscode from "vscode";
import { Choose } from "./confirm";

// Mochi's questions and replies as gentle notifications, not dialogs that
// block VS Code. Closing one counts as no.
export const choose: Choose = async (message, buttons) =>
  vscode.window.showInformationMessage(message, ...buttons);
