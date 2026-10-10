import * as path from "node:path";
import * as vscode from "vscode";
import { choose } from "./actions/choose";
import { offer } from "./actions/confirm";
import { OFFERED, registerPythonSetup, watchPythonProjects } from "./actions/pythonSetup";
import { registerForgetEverything } from "./forgetCommand";
import { dimAction } from "./actions/theme";
import { registerAskCommand } from "./ai/askCommand";
import { Conversation } from "./ai/conversation";
import { registerExplain } from "./ai/explainCommands";
import { createOutputSurface } from "./ai/outputSurface";
import { BrainPicker, copilotWatch, signInToCopilot } from "./ai/brainPicker";
import { ClaudeModels } from "./ai/claudeBrains";
import { ClaudeKey } from "./ai/claudeKey";
import { registerClaudeKeyCommands } from "./ai/claudeKeyCommands";
import { instructionsFor } from "./ai/instructions";
import { loadDefaultPack } from "./packs/defaultPack";
import { registerNameCommands } from "./packs/nameCommands";
import { PersonalLayer } from "./packs/personalLayer";
import { registerFocus } from "./focus/focusCommands";
import { Greeter, rememberCoding } from "./moments/greetingWatcher";
import { Welcomer } from "./moments/welcomeWatcher";
import { LAST_NUDGED, watchLateNight } from "./moments/lateNightWatcher";
import { watchStuck } from "./moments/stuckWatcher";
import { FocusTimer } from "./focus/timer";
import { notificationGreeting } from "./presence/greetingSurface";
import { createMoodLine, showMood } from "./presence/statusBar";
import { onSpeakUpChange, readLearningMode, readSpeakUp } from "./settings";

// What activate() hands back. The integration tests use it to see what the
// mood line says, since VS Code doesn't let tests read the status bar.
export interface MochiApi {
  moodText(): string;
  // Her personal layer, the greeter, and the welcomer, only in the
  // integration tests (Test mode). Other extensions can read Mochi's
  // exports, so they're never handed out otherwise.
  personal?: PersonalLayer;
  greeter?: Greeter;
  welcomer?: Welcomer;
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
  // Found from Mochi's install folder, since the code runs from the bundle.
  const defaultPack = loadDefaultPack(path.join(context.extensionPath, "packs", "default", "pack.json"));
  const personal = new PersonalLayer(context.globalState, defaultPack, (message) => {
    void vscode.window.showWarningMessage(message);
  });
  const pack = () => personal.pack();
  const names = registerNameCommands(personal);

  // Talking to Mochi, through VS Code's built-in AI for now.
  // Answers show in the output panel until the panel chat exists (MOCHI-21).
  const surface = createOutputSurface();
  // The brain is chosen fresh each time she asks: her pick, else Copilot's
  // Auto, else she's asked (MOCHI-53).
  // Her own Claude key, if she adds one, in her system's keychain.
  const claudeKey = new ClaudeKey(context.secrets);
  const claudeModels = new ClaudeModels(claudeKey, context.globalState);
  const brains = new BrainPicker(context.globalState, claudeModels);
  const chooseBrain = brains.register();
  const claudeCommands = registerClaudeKeyCommands(claudeKey, claudeModels, brains);
  const conversation = new Conversation(brains, () => instructionsFor(pack(), readLearningMode()), surface);
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
  // On her first-ever day, the first-run welcome takes the greeting's place
  // (MOCHI-42); never both.
  const welcomer = new Welcomer(context.globalState, pack, () => timer.isRunning(), () => brains.check(), signInToCopilot);
  const greeted = restored.then(async () => (await welcomer.welcome()) ?? greeter.greet());
  // When and where she last coded, for tomorrow's greeting.
  const coding = rememberCoding(context.globalState);

  // Setting up a Python project (MOCHI-28), and offering it once per
  // project, never during a focus session. Never in Restricted Mode.
  const python = registerPythonSetup(choose);
  // The Python offer waits until after the greeting, so two notes don't
  // arrive at once.
  const afterGreeting = greeted.then((text) => (text ? new Promise((done) => setTimeout(done, 5_000)) : undefined));
  const pythonOffer = watchPythonProjects(context.globalState, choose, () => timer.isRunning(), afterGreeting);

  // Developer tools, only when running from source (Run > Start Debugging).
  // They're never in the published package: out/dev/ is left out of the
  // .vsix (.vscodeignore, checked in CI), and package.json doesn't list them.
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    const { registerDevTools } = require("./dev/devTools") as typeof import("./dev/devTools");
    context.subscriptions.push(registerDevTools(personal, greeter));
  }

  // "Mochi: Forget everything" (MOCHI-65): everything Mochi keeps about her,
  // never her settings or a saved AI key. The chat adds its part with
  // MOCHI-21.
  const forget = registerForgetEverything([
    { forget: () => personal.forgetAll() },
    { forget: () => greeter.forget() },
    { forget: () => context.globalState.update(LAST_NUDGED, undefined) },
    { forget: () => context.globalState.update(OFFERED, undefined) },
    // Where the list lived before it moved to one store for all projects.
    { forget: () => context.workspaceState.update(OFFERED, undefined) },
    { forget: () => timer.forgetSaved() },
    // The saved list of her Claude models. Her key itself stays.
    { forget: () => claudeModels.forget() },
  ]);

  // Anything added here is cleaned up when Mochi shuts down.
  context.subscriptions.push(names, claudeKey, claudeCommands, chooseBrain, copilotWatch, open, home, mood, followSpeakUp, focus, timer, surface, ask, explain, stuck, dim, lateNight, coding, python, pythonOffer, forget);

  return {
    moodText: () => mood.text,
    personal: context.extensionMode === vscode.ExtensionMode.Test ? personal : undefined,
    greeter: context.extensionMode === vscode.ExtensionMode.Test ? greeter : undefined,
    welcomer: context.extensionMode === vscode.ExtensionMode.Test ? welcomer : undefined,
  };
}

// VS Code calls this when Mochi shuts down. Nothing to clean up yet.
export function deactivate(): void {}
