import * as vscode from "vscode";
import { Conversation } from "../ai/conversation";
import { AttachmentChip } from "../panel/attachmentChip";
import { ChatLog } from "../panel/chatLog";
import { Pack } from "../packs/format";
import { readLearningMode } from "../settings";
import { celebrateStrings, panelStrings } from "../strings";
import { Finished, celebrationLine, checkMessage } from "./finished";

interface Needs {
  chat: ChatLog;
  pack: () => Pack;
  conversation: Conversation;
  // The code she has selected, if she didn't leave it out.
  attachment: AttachmentChip;
}

// Celebrating when she says she finished something (MOCHI-36): the
// specific thing, in the pack's words, with no AI, then small next steps as
// chips. It celebrates even in quiet mode or a focus session, since she's
// the one who said it.
export function celebrations(needs: Needs) {
  // The next steps, as fits right now.
  const choices = (): string[] => {
    const chips: string[] = [celebrateStrings.checkMyWork];
    // Only on a light theme; high contrast is never changed.
    if (vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light) {
      chips.push(panelStrings.dark);
    }
    return chips;
  };

  const offer = async (finished: Finished): Promise<void> => {
    const pick = await needs.chat.offerNext("", choices());
    if (pick === panelStrings.dark) {
      await vscode.commands.executeCommand("mochi.dim");
    } else if (pick === celebrateStrings.checkMyWork) {
      await checkMyWork(finished);
    }
  };

  // Her selection only, through the share gate, which names the brain.
  // With nothing selected, Mochi says how, and the chips stay.
  const checkMyWork = async (finished: Finished): Promise<void> => {
    const selected = needs.attachment.attached().filter((a) => a.kind === "selection");
    if (selected.length === 0) {
      needs.chat.say(celebrateStrings.selectFirst);
      await offer(finished);
      return;
    }
    await needs.conversation.ask(
      { message: checkMessage(readLearningMode(), finished.thing), attachments: selected },
      celebrateStrings.checkMyWork
    );
  };

  return {
    celebrate(asked: string, finished: Finished): void {
      needs.chat.respond(asked, celebrationLine(needs.pack(), finished));
      void offer(finished);
    },
  };
}
