import * as vscode from "vscode";
import { toFocusMinutes } from "../focus/timer";
import { toSpeakUp } from "../moments/gatekeeper";
import { toLateHour } from "../moments/lateNight";
import { readLearningMode } from "../settings";
import { brainStrings, chatStrings, problemStrings, yoursStrings } from "../strings";
import { checkEdit } from "./edits";
import { ButtonId, Field, FieldId, YoursState } from "./messages";
import { YoursActions } from "./page";

// What the page needs to know from the rest of Mochi.
export interface YoursNeeds {
  // The brain Mochi would think with now, or undefined when it would ask.
  brain(): Promise<string | undefined>;
  hasClaudeKey(): Promise<boolean>;
}

// The command each button runs: the same one she could run herself.
const COMMANDS: Record<ButtonId, string> = {
  chooseBrain: "mochi.chooseBrain",
  addClaudeKey: "mochi.addClaudeKey",
  removeClaudeKey: "mochi.removeClaudeKey",
};

// Which VS Code setting each field is. They're always saved in her user
// settings, never a project's (MOCHI-43).
const SETTINGS: Record<FieldId, string> = {
  speakUp: "speakUp",
  learningMode: "learningMode",
  focusMinutes: "focusMinutes",
  lateHour: "lateHour",
};

const mochi = () => vscode.workspace.getConfiguration("mochi");

// The note shown when a project's own settings win over hers.
function projectNote(setting: string, note: string): { note?: string } {
  const set = mochi().inspect(setting);
  return set?.workspaceValue !== undefined || set?.workspaceFolderValue !== undefined ? { note } : {};
}

// What the page shows, and what happens when she changes something.
export function yoursActions(needs: YoursNeeds): YoursActions {
  const state = async (): Promise<YoursState> => {
    const [brain, hasKey] = await Promise.all([needs.brain(), needs.hasClaudeKey()]);
    // The key itself never reaches the page: only whether there is one.
    const brains: Field[] = [
      {
        kind: "actions",
        now: brain ? brainStrings.now(brain) : brainStrings.nowAsks,
        buttons: [
          { id: "chooseBrain", label: chatStrings.chooseBrain },
          hasKey ? { id: "removeClaudeKey", label: yoursStrings.removeClaudeKey } : { id: "addClaudeKey", label: problemStrings.addClaudeKey },
        ],
      },
    ];
    const talk: Field[] = [
      {
        kind: "choice",
        id: "speakUp",
        label: yoursStrings.speakUp,
        value: toSpeakUp(mochi().get("speakUp")),
        options: yoursStrings.speakUpOptions,
        ...projectNote("speakUp", yoursStrings.projectSpeakUp),
      },
      { kind: "toggle", id: "learningMode", label: yoursStrings.learningMode, description: yoursStrings.learningModeDescription, value: readLearningMode() },
    ];
    const focus: Field[] = [
      {
        kind: "number",
        id: "focusMinutes",
        label: yoursStrings.focusMinutes,
        description: yoursStrings.focusMinutesDescription,
        value: toFocusMinutes(mochi().get("focusMinutes")),
        min: 5,
        max: 120,
        ...projectNote("focusMinutes", yoursStrings.projectFocus),
      },
      {
        kind: "number",
        id: "lateHour",
        label: yoursStrings.lateHour,
        description: yoursStrings.lateHourDescription,
        value: toLateHour(mochi().get("lateHour")),
        min: 0,
        max: 23,
        ...projectNote("lateHour", yoursStrings.projectLateHour),
      },
    ];
    return {
      title: yoursStrings.title,
      saved: yoursStrings.saved,
      sections: [
        { heading: yoursStrings.about, fields: [] },
        { heading: yoursStrings.talk, fields: talk },
        { heading: yoursStrings.brain, fields: brains },
        { heading: yoursStrings.focus, fields: focus },
        { heading: yoursStrings.touches, fields: [] },
      ],
    };
  };

  return {
    state,
    async edit(field, value) {
      const checked = checkEdit(field, value);
      if (!checked.ok) {
        return checked;
      }
      // Her user settings only, never the project's.
      await mochi().update(SETTINGS[field], checked.value, vscode.ConfigurationTarget.Global);
      return { ok: true };
    },
    async button(button) {
      await vscode.commands.executeCommand(COMMANDS[button]);
    },
  };
}
