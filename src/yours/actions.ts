import * as vscode from "vscode";
import { toFocusMinutes } from "../focus/timer";
import { toSpeakUp } from "../moments/gatekeeper";
import { toLateHour } from "../moments/lateNight";
import { readLearningMode } from "../settings";
import { LIMITS, Moment, PackLayer, placeholdersFor } from "../packs/format";
import { layerIsEmpty } from "../packs/gift";
import { brainStrings, chatStrings, giftStrings, personalStrings, problemStrings, yoursStrings } from "../strings";
import { checkEdit, withTouch } from "./edits";
import { BUTTONS, Field, FieldId, MOMENT_IDS, YoursState } from "./messages";
import { YoursActions } from "./page";

// What the page needs to know from the rest of Mochi.
export interface YoursNeeds {
  // The brain Mochi would think with now, or undefined when it would ask.
  brain(): Promise<string | undefined>;
  hasClaudeKey(): Promise<boolean>;
  // Her name, from her personal layer, and saving it with its checks.
  name(): string | undefined;
  setName(name: string): Promise<{ ok: boolean }>;
  // Her whole personal layer, saved only if it passes the pack format's
  // checks, and Mochi's own lines, as examples.
  layer(): PackLayer | undefined;
  saveLayer(layer: PackLayer): Promise<{ ok: boolean }>;
  mochiLines(moment: Moment): string[];
  // Saves her layer as a gift file she picks (MOCHI-55).
  exportLayer(): Promise<unknown>;
}

// The command each button runs: the same one she could run herself.
const COMMANDS: Record<Exclude<(typeof BUTTONS)[number], "exportMine">, string> = {
  forgetName: "mochi.forgetName",
  chooseBrain: "mochi.chooseBrain",
  addClaudeKey: "mochi.addClaudeKey",
  removeClaudeKey: "mochi.removeClaudeKey",
  makeGift: "mochi.makeGift",
};

// Which VS Code setting each field is. They're always saved in her user
// settings, never a project's (MOCHI-43).
const SETTINGS = {
  speakUp: "speakUp",
  learningMode: "learningMode",
  focusMinutes: "focusMinutes",
  lateHour: "lateHour",
} as const;
const isSetting = (field: FieldId): field is keyof typeof SETTINGS => field in SETTINGS;

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
    const name = needs.name();
    const about: Field[] = [
      {
        kind: "text",
        id: "name",
        label: personalStrings.askName,
        value: name ?? "",
        placeholder: personalStrings.askNamePlaceholder,
        maxLength: LIMITS.name,
      },
      ...(name ? [{ kind: "actions" as const, now: "", buttons: [{ id: "forgetName" as const, label: yoursStrings.forgetName }] }] : []),
    ];
    const layer = needs.layer();
    const touches: Field[] = [
      {
        kind: "longText",
        id: "style",
        label: yoursStrings.style,
        description: yoursStrings.styleDescription,
        value: layer?.voice?.style ?? "",
        maxLength: LIMITS.style,
      },
      ...MOMENT_IDS.map(
        (moment): Field => ({
          kind: "lines",
          id: `lines.${moment}`,
          label: yoursStrings.moments[moment],
          description: `${yoursStrings.linesDescription} ${yoursStrings.canUse([...placeholdersFor(moment)])}`,
          value: layer?.phrases?.[moment] ?? [],
          example: needs.mochiLines(moment).join("\n"),
        })
      ),
      // Her touches as a file, once there's something in them, and a gift
      // for someone else (MOCHI-55).
      {
        kind: "actions",
        now: "",
        buttons: [
          ...(layer && !layerIsEmpty(layer) ? [{ id: "exportMine" as const, label: giftStrings.exportMine }] : []),
          { id: "makeGift", label: giftStrings.title },
        ],
      },
    ];
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
        { heading: yoursStrings.about, fields: about },
        { heading: yoursStrings.talk, fields: talk },
        { heading: yoursStrings.brain, fields: brains },
        { heading: yoursStrings.focus, fields: focus },
        { heading: yoursStrings.touches, fields: touches },
      ],
    };
  };

  return {
    state,
    async edit(field, value) {
      // Her style notes and her own lines go into her personal layer.
      if (field === "style" || field.startsWith("lines.")) {
        const touch = field === "style" ? "style" : (field.slice("lines.".length) as Moment);
        const next = withTouch(needs.layer(), touch, value);
        if (!next.ok) {
          return next;
        }
        return (await needs.saveLayer(next.layer)).ok ? { ok: true } : { ok: false, hint: yoursStrings.couldntSave };
      }
      const checked = checkEdit(field, value);
      if (!checked.ok) {
        return checked;
      }
      // Her name lives in her personal layer, on her own computer.
      if (field === "name") {
        return (await needs.setName(checked.value as string)).ok ? { ok: true } : { ok: false, hint: yoursStrings.couldntSave };
      }
      if (!isSetting(field)) {
        return { ok: false, hint: yoursStrings.pickOne };
      }
      // Her user settings only, never the project's.
      await mochi().update(SETTINGS[field], checked.value, vscode.ConfigurationTarget.Global);
      return { ok: true };
    },
    async button(button) {
      if (button === "exportMine") {
        await needs.exportLayer();
      } else if (button in COMMANDS) {
        await vscode.commands.executeCommand(COMMANDS[button as keyof typeof COMMANDS]);
      }
    },
  };
}
