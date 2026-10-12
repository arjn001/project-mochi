import * as vscode from "vscode";
import { ChatLog } from "../panel/chatLog";
import { Pack } from "../packs/format";
import { panelStrings } from "../strings";
import { Finished, celebrationLine } from "./finished";

interface Needs {
  chat: ChatLog;
  pack: () => Pack;
}

// Celebrating when she says she finished something (MOCHI-36): the
// specific thing, in the pack's words, with no AI, then small next steps as
// chips. It celebrates even in quiet mode or a focus session, since she's
// the one who said it.
export function celebrations(needs: Needs) {
  // The next steps, as fits right now.
  const choices = (): string[] => {
    const chips: string[] = [];
    // Only on a light theme; high contrast is never changed.
    if (vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light) {
      chips.push(panelStrings.dark);
    }
    return chips;
  };

  const offer = async (): Promise<void> => {
    const chips = choices();
    if (chips.length === 0) {
      return;
    }
    const pick = await needs.chat.offerNext("", chips);
    if (pick === panelStrings.dark) {
      await vscode.commands.executeCommand("mochi.dim");
    }
  };

  return {
    celebrate(asked: string, finished: Finished): void {
      needs.chat.respond(asked, celebrationLine(needs.pack(), finished));
      void offer();
    },
  };
}
