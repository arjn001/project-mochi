import * as vscode from "vscode";
import { claudeKeyStrings as s } from "../strings";
import { readBrainSetting, saveBrainSetting } from "../settings";
import { BrainPicker } from "./brainPicker";
import { CLAUDE_VENDOR, toBrainSetting } from "./brains";
import { CONSOLE_KEYS, ClaudeProblem, connect, keyInputProblem, listModels } from "./claude";
import { ClaudeModels } from "./claudeBrains";
import { ClaudeKey } from "./claudeKey";

// VS Code's own page on fixing the system keychain, mostly for Linux
// (checked 2026-10-09).
const KEYCHAIN_HELP = "https://code.visualstudio.com/docs/configure/settings-sync#_troubleshoot-credential-store-issues";

const open = (url: string) => vscode.env.openExternal(vscode.Uri.parse(url));

// "Mochi: Add a Claude key" (MOCHI-53, part 2). True once she's added a key
// and picked a Claude model.
async function addClaudeKey(key: ClaudeKey, models: ClaudeModels, picker: BrainPicker): Promise<boolean> {
  const replacing = (await key.get()) !== undefined;
  const detail = [s.intro, s.tip, ...(replacing ? [s.replaces] : [])].join("\n\n");
  const choice = await vscode.window.showInformationMessage(s.title, { modal: true, detail }, s.getKey, s.haveKey);
  if (!choice) {
    return false;
  }
  if (choice === s.getKey) {
    await open(CONSOLE_KEYS);
  }
  // Until she pastes a key that works, or stops.
  for (;;) {
    const typed = await vscode.window.showInputBox({
      title: s.title,
      prompt: s.prompt,
      placeHolder: s.placeholder,
      password: true,
      // Stays open while she copies the key from her browser.
      ignoreFocusOut: true,
      validateInput: keyInputProblem,
    });
    if (typed === undefined) {
      return false;
    }
    const pasted = typed.trim();
    // The free model listing: no answer, no cost.
    const listing = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: s.checking },
      () => listModels(connect(pasted))
    );
    if (!listing.ok) {
      if (await tryAgainAfter(listing.problem)) {
        continue;
      }
      return false;
    }
    try {
      await key.save(pasted);
    } catch {
      if ((await vscode.window.showWarningMessage(s.noKeychain, s.howToFix)) === s.howToFix) {
        await open(KEYCHAIN_HELP);
      }
      return false;
    }
    await models.remember(listing.models);
    if (listing.models.length === 0) {
      void vscode.window.showInformationMessage(s.noModels);
      return false;
    }
    if (await picker.chooseClaudeModel(listing.models)) {
      return true;
    }
    void vscode.window.showInformationMessage(s.savedNoPick);
    return false;
  }
}

// Why the check didn't work, and whether she wants to paste it again.
async function tryAgainAfter(problem: ClaudeProblem): Promise<boolean> {
  if (problem === "keyRejected") {
    const next = await vscode.window.showWarningMessage(s.rejected, s.tryAgain, s.getKey);
    if (next === s.getKey) {
      await open(CONSOLE_KEYS);
    }
    return next !== undefined;
  }
  const line = problem === "offline" || problem === "timeout" ? s.cantReach : s.cantCheck;
  return (await vscode.window.showWarningMessage(line, s.tryAgain)) === s.tryAgain;
}

// "Mochi: Remove my Claude key". Also forgets the saved list of her Claude
// models, and her pick if it was one of them, so she isn't told about a
// stand-in for a model she removed on purpose.
async function removeClaudeKey(key: ClaudeKey, models: ClaudeModels): Promise<void> {
  if ((await key.get()) === undefined) {
    void vscode.window.showInformationMessage(s.nothingToRemove);
    return;
  }
  const answer = await vscode.window.showWarningMessage(
    s.removeQuestion,
    { modal: true, detail: s.removeDetail },
    s.remove,
    s.keep
  );
  if (answer !== s.remove) {
    return;
  }
  await key.remove();
  await models.forget();
  if (toBrainSetting(readBrainSetting())?.vendor === CLAUDE_VENDOR) {
    await saveBrainSetting("");
  }
  void vscode.window.showInformationMessage(s.removed);
}

export function registerClaudeKeyCommands(key: ClaudeKey, models: ClaudeModels, picker: BrainPicker): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand("mochi.addClaudeKey", () => addClaudeKey(key, models, picker)),
    vscode.commands.registerCommand("mochi.removeClaudeKey", () => removeClaudeKey(key, models))
  );
}
