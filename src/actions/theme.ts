import * as vscode from "vscode";
import { Action, defineAction } from "./confirm";
import { DARKER_THEME, ThemeKind, dimTexts, skipDimming } from "./darkerTheme";

function currentKind(): ThemeKind {
  switch (vscode.window.activeColorTheme.kind) {
    case vscode.ColorThemeKind.Dark:
      return "dark";
    case vscode.ColorThemeKind.Light:
      return "light";
    default:
      return "highContrast";
  }
}

// Switches the whole of VS Code to a darker theme, in her user settings, so
// it stays after a restart. Undo puts her old theme back exactly.
export function dimAction(): Action {
  return defineAction({
    ...dimTexts,
    skip: () => skipDimming(currentKind()),
    act: async () => {
      const workbench = vscode.workspace.getConfiguration("workbench");
      const before = workbench.inspect<string>("colorTheme")?.globalValue;
      await workbench.update("colorTheme", DARKER_THEME, vscode.ConfigurationTarget.Global);
      return async () => {
        await vscode.workspace
          .getConfiguration("workbench")
          .update("colorTheme", before, vscode.ConfigurationTarget.Global);
      };
    },
  });
}
