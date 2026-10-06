import * as vscode from "vscode";
import { choose } from "./actions/choose";
import { offer } from "./actions/confirm";
import { registerPythonSetup, watchPythonProjects } from "./actions/pythonSetup";
import { dimAction } from "./actions/theme";
import { registerAskCommand } from "./ai/askCommand";
import { Conversation } from "./ai/conversation";
import { registerExplain } from "./ai/explainCommands";
import { createOutputSurface } from "./ai/outputSurface";
import { BuiltInAi } from "./ai/builtInAi";
import { instructionsFor } from "./ai/instructions";
import { loadDefaultPack } from "./packs/defaultPack";
import { registerNameCommands } from "./packs/nameCommands";
import { PersonalLayer } from "./packs/personalLayer";
import { registerFocus } from "./focus/focusCommands";
import { Greeter, rememberCoding } from "./moments/greetingWatcher";
import { watchLateNight } from "./moments/lateNightWatcher";
import { watchStuck } from "./moments/stuckWatcher";
import { FocusTimer } from "./focus/timer";
import { notificationGreeting } from "./presence/greetingSurface";
import { createMoodLine, showMood } from "./presence/statusBar";
import { onSpeakUpChange, readSpeakUp } from "./settings";

// What activate() hands back. The integration tests use it to see what the
// mood line says, since VS Code doesn't let tests read the status bar.
export interface MochiApi {
  moodText(): string;
  // Her personal layer, only in the integration tests (Test mode). Other
  // extensions can read Mochi's exports, so it's never handed out otherwise.
  personal?: PersonalLayer;
}

// VS Code calls this once, after it finishes starting up.
export function activate(context: vscode.ExtensionContext): MochiApi {
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
  const restored = timer.restore();

  // Mochi's personality comes from the default pack, with her personal layer
  // on top (MOCHI-41). pack() is read fresh each time Mochi speaks, so a
  // change to her layer shows up right away.
  const personal = new PersonalLayer(context.globalState, loadDefaultPack(), (message) => {
    void vscode.window.showWarningMessage(message);
  });
  const pack = () => personal.pack();
  const names = registerNameCommands(personal);

  // Talking to Mochi, through VS Code's built-in AI for now.
  // Answers show in the output panel until the panel chat exists (MOCHI-21).
  const surface = createOutputSurface();
  const conversation = new Conversation(new BuiltInAi(), () => instructionsFor(pack()), surface);
  const ask = registerAskCommand(conversation);
  const explain = registerExplain(conversation, surface);

  // A gentle "Need a paw?" next to an error she's been stuck on (MOCHI-34).
  const stuck = watchStuck();

  // Actions always ask first (MOCHI-31). The late-night nudge offers the
  // same one, in the pack's words.
  const dim = vscode.commands.registerCommand("mochi.dim", () => offer(dimAction(), choose));
  const lateNight = watchLateNight(pack, timer, context.globalState);

  // The greeting when VS Code opens, once a day (MOCHI-33). It waits for a
  // saved focus session to be picked up, so it knows if she's focusing.
  const greeter = new Greeter(context.globalState, pack, () => timer.isRunning(), notificationGreeting);
  const greeted = restored.then(() => greeter.greet());
  // When and where she last coded, for tomorrow's greeting.
  const coding = rememberCoding(context.globalState);

  // Setting up a Python project (MOCHI-28), and offering it once per
  // project, never during a focus session. Never in Restricted Mode.
  const python = registerPythonSetup(choose);
  // The Python offer waits until after the greeting, so two notes don't
  // arrive at once.
  const afterGreeting = greeted.then((text) => (text ? new Promise((done) => setTimeout(done, 5_000)) : undefined));
  const pythonOffer = watchPythonProjects(context.workspaceState, choose, () => timer.isRunning(), afterGreeting);

  // Developer tools, only when running from source (Run > Start Debugging).
  // They're never in the published package: out/dev/ is left out of the
  // .vsix (.vscodeignore, checked in CI), and package.json doesn't list them.
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    const { registerDevTools } = require("./dev/devTools") as typeof import("./dev/devTools");
    context.subscriptions.push(registerDevTools(personal, greeter));
  }

  // Anything added here is cleaned up when Mochi shuts down.
  context.subscriptions.push(names, open, home, mood, followSpeakUp, focus, timer, surface, ask, explain, stuck, dim, lateNight, coding, python, pythonOffer);

  return {
    moodText: () => mood.text,
    personal: context.extensionMode === vscode.ExtensionMode.Test ? personal : undefined,
  };
}

// VS Code calls this when Mochi shuts down. Nothing to clean up yet.
export function deactivate(): void {}
