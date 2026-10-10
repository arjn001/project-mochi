import * as vscode from "vscode";
import { readBrainSetting, saveBrainSetting } from "../settings";
import { BrainCheck } from "../moments/welcome";
import { brainStrings, claudeKeyStrings, problemStrings, welcomeStrings } from "../strings";
import { BrainInfo, CLAUDE_VENDOR, brainKey, brainLabel, chooseBrain, fallbackNote, isAuto, isUsable, toBrainSetting } from "./brains";
import { ModelBrain } from "./builtInAi";
import { ClaudeModel, isStartingPoint, startingPointFirst } from "./claude";
import { ClaudeModels } from "./claudeBrains";
import { Provider } from "./provider";

// The last stand-in note shown, so it's shown once per change.
const NOTED = "mochi.brainNoted";
// The names of brains she picked, so a note can name one that's gone.
const LABELS = "mochi.brainLabels";

// A brain she can pick, and how to ask it.
type Brain = BrainInfo & { make(): Provider };

// Some models don't say how much they can take; one that's listed can take
// a message.
const UNKNOWN_LIMIT = 100_000;

export type ForQuestion =
  | { kind: "none" }
  // She closed the list without picking: Mochi doesn't think at all.
  | { kind: "waiting" }
  // `note` is the stand-in note; call `noted()` once it's actually shown.
  | { kind: "use"; provider: Provider; note?: string; noted?: () => Thenable<void> };

type Item = vscode.QuickPickItem & { key?: string; action?: "auto" | "signIn" | "addClaudeKey" };

// Which brain Mochi thinks with. Checked fresh every time she asks, so a
// brain that appears or disappears (signing in or out, an extension added)
// is noticed with no restart.
export class BrainPicker {
  constructor(
    private readonly state: vscode.Memento,
    private readonly claude: ClaudeModels
  ) {}

  // VS Code's built-in AI (Copilot and other extensions), then her Claude
  // models if she added a key.
  private async brains(): Promise<Brain[]> {
    const [builtIn, claude] = await Promise.all([this.builtInBrains(), this.claude.list()]);
    return [
      ...builtIn,
      ...claude.map((model) => ({
        vendor: CLAUDE_VENDOR,
        id: model.id,
        name: model.name,
        maxInputTokens: model.maxInputTokens ?? UNKNOWN_LIMIT,
        make: () => this.claude.brain(model),
      })),
    ];
  }

  private async builtInBrains(): Promise<Brain[]> {
    try {
      const models = await vscode.lm.selectChatModels();
      return models.map((model) => ({
        vendor: model.vendor,
        id: model.id,
        name: model.name,
        maxInputTokens: model.maxInputTokens,
        make: () => new ModelBrain(model, brainLabel(model)),
      }));
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
      // She has a key, but Claude listed no models, or couldn't be asked
      // and there's no earlier listing: she's set up, so Mochi waits.
      return (await this.claude.key.get()) ? { kind: "waiting" } : { kind: "none" };
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
    const provider = choice.brain.make();
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
      items.push({
        label: brainLabel(brain),
        description: brain.vendor === CLAUDE_VENDOR ? brainStrings.billedPerUse : undefined,
        key: brainKey(brain),
        iconPath: used ? check : undefined,
      });
    }
    if (usable.length === 0 && (await hasCopilotSetup())) {
      items.push({ label: brainStrings.signIn, action: "signIn" });
    }
    if (!(await this.claude.key.get())) {
      items.push({ label: problemStrings.addClaudeKey, description: brainStrings.billedPerUse, action: "addClaudeKey" });
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
    if (picked.action === "addClaudeKey") {
      // True once she's added a key and picked a Claude model.
      return (await vscode.commands.executeCommand<boolean>("mochi.addClaudeKey")) ? "picked" : "closed";
    }
    if (picked.action === "auto") {
      await saveBrainSetting("");
      if (!fromQuestion) {
        void vscode.window.showInformationMessage(brainStrings.pickedAuto);
      }
      return "picked";
    }
    await this.savePick(picked.key!, picked.label);
    if (!fromQuestion) {
      void vscode.window.showInformationMessage(brainStrings.picked(picked.label));
    }
    return "picked";
  }

  // "Which Claude model should Mochi use?", right after her key checks
  // out. True if she picked one.
  async chooseClaudeModel(models: readonly ClaudeModel[]): Promise<boolean> {
    const setting = toBrainSetting(readBrainSetting());
    const check = new vscode.ThemeIcon("check");
    const items: Item[] = startingPointFirst(models).map((model) => {
      const key = brainKey({ vendor: CLAUDE_VENDOR, id: model.id });
      return {
        label: model.name,
        description: brainStrings.billedPerUse,
        detail: isStartingPoint(model.id) ? claudeKeyStrings.startingPoint : undefined,
        key,
        iconPath: setting && brainKey(setting) === key ? check : undefined,
      };
    });
    const picked = await vscode.window.showQuickPick(items, {
      title: claudeKeyStrings.modelTitle,
      placeHolder: claudeKeyStrings.modelPlaceholder,
    });
    if (!picked) {
      return false;
    }
    await this.savePick(picked.key!, picked.label);
    void vscode.window.showInformationMessage(brainStrings.picked(picked.label));
    return true;
  }

  // Her pick, and its name, so a note can name it if it's ever gone.
  private async savePick(key: string, label: string): Promise<void> {
    await this.state.update(LABELS, { ...this.labels(), [key]: label });
    await saveBrainSetting(key);
  }

  // For the first-run welcome: which brain Mochi would think with, without
  // asking any brain anything. Right after VS Code starts, Copilot may not
  // have shown up yet, so with nothing found it waits up to WAIT_MS for
  // VS Code's "models changed" and looks once more.
  async check(): Promise<BrainCheck> {
    let choice = chooseBrain(readBrainSetting(), await this.brains());
    if (choice.kind === "none") {
      await modelsChangeOr(WAIT_MS);
      choice = chooseBrain(readBrainSetting(), await this.brains());
    }
    if (choice.kind === "use") {
      return { kind: "ready", label: brainLabel(choice.brain) };
    }
    return choice.kind === "ask" ? { kind: "ask" } : { kind: "none", copilotSetup: await hasCopilotSetup() };
  }

  register(): vscode.Disposable {
    return vscode.commands.registerCommand("mochi.chooseBrain", () => this.choose());
  }
}

// How long the welcome's brain check waits for Copilot to show up.
const WAIT_MS = 8_000;

function modelsChangeOr(ms: number): Promise<void> {
  return new Promise((done) => {
    const timer = setTimeout(finish, ms);
    const listening = vscode.lm.onDidChangeChatModels(finish);
    function finish() {
      clearTimeout(timer);
      listening.dispose();
      done();
    }
  });
}

// Says "Got a brain! Ask me anything." once Copilot is ready, after she
// started its setup from Mochi. One watch at a time; it ends when Mochi
// does (pushed to the extension's subscriptions).
let watching: vscode.Disposable | undefined;
export const copilotWatch: vscode.Disposable = { dispose: () => stopWatching() };

function stopWatching(): void {
  watching?.dispose();
  watching = undefined;
}

function confirmWhenCopilotIsReady(): void {
  if (watching) {
    return;
  }
  watching = vscode.lm.onDidChangeChatModels(async () => {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
      if (models.some(isUsable)) {
        stopWatching();
        void vscode.window.showInformationMessage(welcomeStrings.gotABrain);
      }
    } catch {
      // Still not ready; the next change looks again.
    }
  });
}

// Whether this editor has VS Code's Copilot setup. Editors from Open VSX,
// like VSCodium, often don't.
async function hasCopilotSetup(): Promise<boolean> {
  return (await vscode.commands.getCommands(true)).includes("workbench.action.chat.triggerSetup");
}

// "Set one up", from the no-brain line: Copilot's own setup where there is
// one, otherwise Choose a brain, which offers "Add a Claude key". Never a
// dead end. "Pick a brain" replaces this in MOCHI-42.
export async function setUpABrain(): Promise<void> {
  if (await hasCopilotSetup()) {
    await signInToCopilot();
  } else {
    await vscode.commands.executeCommand("mochi.chooseBrain");
  }
}

// VS Code's own Copilot sign-in, until "Pick a brain" exists (MOCHI-42).
export async function signInToCopilot(): Promise<void> {
  confirmWhenCopilotIsReady();
  try {
    await vscode.commands.executeCommand("workbench.action.chat.triggerSetup");
  } catch {
    await vscode.commands.executeCommand("workbench.action.chat.open");
  }
}
