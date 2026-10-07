import * as vscode from "vscode";
import { readBrainSetting, saveBrainSetting } from "../settings";
import { brainStrings } from "../strings";
import { BrainInfo, brainKey, brainLabel, chooseBrain, fallbackNote, isAuto, isUsable, toBrainSetting } from "./brains";
import { ModelBrain } from "./builtInAi";
import { Provider } from "./provider";

// The last stand-in note shown, so it's shown once per change.
const NOTED = "mochi.brainNoted";
// The names of brains she picked, so a note can name one that's gone.
const LABELS = "mochi.brainLabels";

type Brain = BrainInfo & { model: vscode.LanguageModelChat };

export type ForQuestion =
  | { kind: "none" }
  // She closed the list without picking: Mochi doesn't think at all.
  | { kind: "waiting" }
  // `note` is the stand-in note; call `noted()` once it's actually shown.
  | { kind: "use"; provider: Provider; note?: string; noted?: () => Thenable<void> };

type Item = vscode.QuickPickItem & { key?: string; action?: "auto" | "signIn" };

// Which brain Mochi thinks with. Checked fresh every time she asks, so a
// brain that appears or disappears (signing in or out, an extension added)
// is noticed with no restart.
export class BrainPicker {
  constructor(private readonly state: vscode.Memento) {}

  private async brains(): Promise<Brain[]> {
    try {
      const models = await vscode.lm.selectChatModels();
      return models.map((model) => ({ vendor: model.vendor, id: model.id, name: model.name, maxInputTokens: model.maxInputTokens, model }));
    } catch {
      return [];
    }
  }

  private labels(): Record<string, string> {
    const saved = this.state.get(LABELS);
    return typeof saved === "object" && saved !== null ? (saved as Record<string, string>) : {};
  }

  // Called when she asks something, and only then.
  async forQuestion(): Promise<ForQuestion> {
    const all = await this.brains();
    let choice = chooseBrain(readBrainSetting(), all);
    if (choice.kind === "none") {
      return { kind: "none" };
    }
    if (choice.kind === "ask") {
      // No Auto and no pick: never choose another model for her.
      if ((await this.choose(true)) !== "picked") {
        return { kind: "waiting" };
      }
      choice = chooseBrain(readBrainSetting(), await this.brains());
      if (choice.kind !== "use") {
        return { kind: "waiting" };
      }
    }
    const missingLabel = choice.missing ? this.labels()[brainKey(choice.missing)] : undefined;
    const { note, noted } = fallbackNote(choice, this.state.get<string>(NOTED), missingLabel);
    const provider = new ModelBrain(choice.brain.model, brainLabel(choice.brain));
    if (!note) {
      await this.state.update(NOTED, noted);
      return { kind: "use", provider };
    }
    // Remembered only once she's seen it, not if she stops at the share gate.
    return { kind: "use", provider, note, noted: () => this.state.update(NOTED, noted) };
  }

  // "Which brain should Mochi think with?" From a question, "Let Mochi
  // choose" only appears when there's an Auto to choose.
  async choose(fromQuestion = false): Promise<"picked" | "closed"> {
    const usable = (await this.brains()).filter(isUsable);
    const auto = usable.find(isAuto);
    const setting = toBrainSetting(readBrainSetting());
    const inUse = chooseBrain(readBrainSetting(), usable);
    const check = new vscode.ThemeIcon("check");

    const items: Item[] = [];
    if (!fromQuestion || auto) {
      items.push({
        label: brainStrings.letMochiChoose,
        description: auto ? brainStrings.now(brainLabel(auto)) : brainStrings.nowAsks,
        iconPath: setting ? undefined : check,
        action: "auto",
      });
    }
    for (const brain of usable) {
      const used = setting !== undefined && inUse.kind === "use" && brainKey(inUse.brain) === brainKey(brain);
      items.push({ label: brainLabel(brain), key: brainKey(brain), iconPath: used ? check : undefined });
    }
    if (usable.length === 0) {
      items.push({ label: brainStrings.signIn, action: "signIn" });
    }

    const picked = await vscode.window.showQuickPick(items, {
      title: brainStrings.title,
      placeHolder: usable.some((brain) => brain.vendor === "copilot") ? brainStrings.usesCopilotPlan : undefined,
    });
    if (!picked) {
      return "closed";
    }
    if (picked.action === "signIn") {
      await signInToCopilot();
      return "closed";
    }
    if (picked.action === "auto") {
      await saveBrainSetting("");
      if (!fromQuestion) {
        void vscode.window.showInformationMessage(brainStrings.pickedAuto);
      }
      return "picked";
    }
    await this.state.update(LABELS, { ...this.labels(), [picked.key!]: picked.label });
    await saveBrainSetting(picked.key!);
    if (!fromQuestion) {
      void vscode.window.showInformationMessage(brainStrings.picked(picked.label));
    }
    return "picked";
  }

  register(): vscode.Disposable {
    return vscode.commands.registerCommand("mochi.chooseBrain", () => this.choose());
  }
}

// VS Code's own Copilot sign-in, until "Pick a brain" exists (MOCHI-42).
export async function signInToCopilot(): Promise<void> {
  try {
    await vscode.commands.executeCommand("workbench.action.chat.triggerSetup");
  } catch {
    await vscode.commands.executeCommand("workbench.action.chat.open");
  }
}
