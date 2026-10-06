import * as vscode from "vscode";
import { choose } from "./actions/choose";
import { offer } from "./actions/confirm";
import { dimAction } from "./actions/theme";
import { registerAskCommand } from "./ai/askCommand";
import { Conversation } from "./ai/conversation";
import { registerExplain } from "./ai/explainCommands";
import { createOutputSurface } from "./ai/outputSurface";
import { BuiltInAi } from "./ai/builtInAi";
import { instructionsFor } from "./ai/instructions";
import { loadDefaultPack } from "./packs/defaultPack";
import { registerFocus } from "./focus/focusCommands";
import { watchLateNight } from "./moments/lateNightWatcher";
import { FocusTimer } from "./focus/timer";
import { createMoodLine, showMood } from "./presence/statusBar";
import { onSpeakUpChange, readSpeakUp } from "./settings";

// What activate() hands back. The integration tests use it to see what the
// mood line says, since VS Code doesn't let tests read the status bar.
export interface MochiApi {
  moodText(): string;
}

// VS Code calls this once, after it finishes starting up.
export function activate(context: vscode.ExtensionContext): MochiApi {
  const sayHello = vscode.commands.registerCommand("mochi.sayHello", () => {
    vscode.window.showInformationMessage("Hello from Mochi!");
  });

  // Opens Mochi's tab in the secondary side bar, even if that bar is closed.
  const open = vscode.commands.registerCommand("mochi.open", () =>
    vscode.commands.executeCommand("workbench.view.extension.mochi")
  );

  // Mochi's home view is empty for now, so VS Code shows the welcome text
  // from package.json. The real panel replaces this in MOCHI-16.
  const home = vscode.window.registerTreeDataProvider("mochi.home", {
    getTreeItem: (item: vscode.TreeItem) => item,
    getChildren: () => [],
  });

  // The focus timer keeps its end time in globalState, so a session
  // survives a reload.
  const timer = new FocusTimer(context.globalState);

  // The mood line follows the speak-up setting and the focus timer.
  const mood = createMoodLine();
  const refreshMood = () => showMood(mood, readSpeakUp(), undefined, timer.minutesLeft());
  refreshMood();
  const followSpeakUp = onSpeakUpChange(refreshMood);
  const focus = registerFocus(timer, refreshMood);
  void timer.restore();

  // Mochi's personality comes from the pack. The personal layer goes on top
  // of the default pack later (MOCHI-41).
  const pack = loadDefaultPack();

  // Talking to Mochi, through VS Code's built-in AI for now.
  // Answers show in the output panel until the panel chat exists (MOCHI-21).
  const surface = createOutputSurface();
  const conversation = new Conversation(new BuiltInAi(), () => instructionsFor(pack), surface);
  const ask = registerAskCommand(conversation);
  const explain = registerExplain(conversation, surface);

  // Actions always ask first (MOCHI-31). The late-night nudge offers the
  // same one, in the pack's words.
  const dim = vscode.commands.registerCommand("mochi.dim", () => offer(dimAction(), choose));
  const lateNight = watchLateNight(pack, timer, context.globalState);

  // Anything added here is cleaned up when Mochi shuts down.
  context.subscriptions.push(sayHello, open, home, mood, followSpeakUp, focus, timer, surface, ask, explain, dim, lateNight);

  return { moodText: () => mood.text };
}

// VS Code calls this when Mochi shuts down. Nothing to clean up yet.
export function deactivate(): void {}
