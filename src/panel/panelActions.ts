import * as vscode from "vscode";
import { brainButton } from "../ai/brains";
import { Conversation } from "../ai/conversation";
import { errorInEditor } from "../ai/explainCommands";
import { FocusTimer } from "../focus/timer";
import { Greeter } from "../moments/greetingWatcher";
import { Pack } from "../packs/format";
import { moodLine, moodParts } from "../presence/mood";
import { readSpeakUp } from "../settings";
import { chatStrings, panelStrings, welcomeStrings } from "../strings";
import { AttachmentChip } from "./attachmentChip";
import { ChatLog } from "./chatLog";
import { safeLink } from "./format";
import { PanelButton, PanelState } from "./messages";
import { PanelActions } from "./panelView";

interface Needs {
  timer: FocusTimer;
  greeter: Greeter;
  pack: () => Pack;
  conversation: Conversation;
  chat: ChatLog;
  attachment: AttachmentChip;
  setUpCopilot: () => Promise<void>;
  // The brain Mochi would think with now, or undefined when it would ask.
  brain: () => string | undefined;
  // A short line under the buttons.
  hint: (text: string) => void;
  // Shows the latest state in the panel.
  refresh: () => void;
}

// What the panel shows, and what its buttons and box do (MOCHI-16). Every
// button runs the same command the Command Palette has, under the same name.
export function panelActions(needs: Needs): PanelActions {
  const { timer, greeter, pack, conversation } = needs;

  const state = (): PanelState => {
    const today = greeter.todays();
    const attachment = needs.attachment.shown();
    const welcomeButton = today.button === "setUpCopilot" ? welcomeStrings.setUpCopilot : today.button === "chooseBrain" ? welcomeStrings.chooseBrain : undefined;
    return {
      // The same mood as the status bar, from the same rules.
      mood: moodParts(moodLine(readSpeakUp(), undefined, timer.minutesLeft())),
      greeting: today.text,
      ...(welcomeButton ? { welcomeButton } : {}),
      buttons: {
        explain: panelStrings.explain,
        focus: timer.isRunning() ? panelStrings.stopFocus : panelStrings.startFocus,
        dark: panelStrings.dark,
      },
      ask: { label: panelStrings.ask(pack().name), send: panelStrings.send },
      brain: brainButton(needs.brain()),
      ...(attachment ? { attachment } : {}),
      chat: { empty: chatStrings.empty, you: chatStrings.you, mochi: pack().name, copy: chatStrings.copy, copied: chatStrings.copied },
    };
  };

  // What she typed, plus the code she has selected unless she left it out,
  // through the share gate (which also warns about text that looks like a
  // secret).
  const ask = async (text: string): Promise<boolean> =>
    (await conversation.ask({ message: text, attachments: needs.attachment.attached() }, text)) !== undefined;

  const button = async (pressed: PanelButton): Promise<void> => {
    switch (pressed) {
      case "explain": {
        // The code she selected, otherwise the error under her cursor (or
        // the first in the file), otherwise a hint.
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
          await vscode.commands.executeCommand("mochi.explainSelection");
        } else if (editor && errorInEditor(editor)) {
          await vscode.commands.executeCommand("mochi.explainError");
        } else {
          needs.hint(panelStrings.explainHint);
        }
        return;
      }
      case "focus":
        await vscode.commands.executeCommand(timer.isRunning() ? "mochi.focus.stop" : "mochi.focus");
        return;
      case "dark":
        await vscode.commands.executeCommand("mochi.dim");
        return;
      case "brain":
        await vscode.commands.executeCommand("mochi.chooseBrain");
        return;
      case "welcome": {
        // Used once: the welcome stays as today's greeting, without its button.
        const { button: chosen, ...today } = greeter.todays();
        if (!chosen) {
          return;
        }
        greeter.keepToday(today);
        needs.refresh();
        if (chosen === "setUpCopilot") {
          await needs.setUpCopilot();
        } else {
          await vscode.commands.executeCommand("mochi.chooseBrain");
        }
        return;
      }
    }
  };

  return {
    state,
    chat: () => needs.chat.entries(),
    ask,
    button,
    chip: (entry, chip) => needs.chat.choose(entry, chip),
    leaveOut: () => needs.attachment.leaveOut(),
    // Copy only copies.
    copy: async (text) => {
      await vscode.env.clipboard.writeText(text);
    },
    // Checked again here: only an https link with nothing hidden in it, and
    // VS Code asks first for sites she hasn't trusted.
    openLink: async (url) => {
      const link = safeLink(url);
      if (link) {
        await vscode.env.openExternal(vscode.Uri.parse(link.url));
      }
    },
  };
}
