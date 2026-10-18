import * as path from "node:path";
import * as vscode from "vscode";
import { choose } from "./actions/choose";
import { offer } from "./actions/confirm";
import { OFFERED, registerPythonSetup, watchPythonProjects } from "./actions/pythonSetup";
import { registerForgetEverything } from "./forgetCommand";
import { dimAction } from "./actions/theme";
import { Conversation } from "./ai/conversation";
import { registerExplain } from "./ai/explainCommands";
import { BrainPicker, copilotWatch, signInToCopilot, whenCopilotIsReady } from "./ai/brainPicker";
import { welcomeText } from "./moments/welcome";
import { welcomeStrings } from "./strings";
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
import { celebrations } from "./moments/celebrate";
import { MakeItYours } from "./yours/page";
import { yoursActions } from "./yours/actions";
import { FocusTimer } from "./focus/timer";
import { GreetingSurface, notificationGreeting } from "./presence/greetingSurface";
import { nightOf } from "./moments/lateNight";
import { MochiPanel } from "./panel/panelView";
import { panelActions } from "./panel/panelActions";
import { AttachmentChip } from "./panel/attachmentChip";
import { ChatLog } from "./panel/chatLog";
import { CHATS_GENERATION, ChatMemory, registerClearChat } from "./panel/chatMemory";
import { ChatStore } from "./panel/chatStore";
import { spokenMessage } from "./panel/spoken";
import { createMoodLine, showMood } from "./presence/statusBar";
import { onSpeakUpChange, readLearningMode, readSpeakUp } from "./settings";

// What activate() hands back. The integration tests use it to see what the
// mood line says, since VS Code doesn't let tests read the status bar.
export interface MochiApi {
  moodText(): string;
  // Her personal layer, the greeter, the welcomer, and the panel, only in
  // the integration tests (Test mode). Other extensions can read Mochi's
  // exports, so they're never handed out otherwise.
  personal?: PersonalLayer;
  greeter?: Greeter;
  welcomer?: Welcomer;
  panel?: MochiPanel;
  // The chat, and the panel's own "send", to test the chat in real VS Code.
  chat?: ChatLog;
  memory?: ChatMemory;
  attachment?: AttachmentChip;
  ask?: (text: string) => Promise<boolean>;
}

// VS Code calls this once, after it finishes starting up.
export function activate(context: vscode.ExtensionContext): MochiApi {
  // Opens Mochi's tab in the secondary side bar, even if that bar is closed.
  const open = vscode.commands.registerCommand("mochi.open", () =>
    vscode.commands.executeCommand("workbench.view.extension.mochi")
  );

  // The focus timer keeps its end time in globalState, so a session
  // survives a reload.
  const timer = new FocusTimer(context.globalState);

  // The mood line follows the speak-up setting and the focus timer, and so
  // does the panel, once it exists below.
  const mood = createMoodLine();
  let refreshPanel = () => {};
  const refreshMood = () => {
    showMood(mood, readSpeakUp(), undefined, timer.minutesLeft(), timer.breakMinutesLeft());
    refreshPanel();
  };
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

  // Talking to Mochi. Answers, next steps, and kind lines about problems all
  // show in the chat in Mochi's panel (MOCHI-21), created below.
  const chat = new ChatLog(
    (change) => {
      if (change.type === "done") {
        // Screen readers hear a finished message once (MOCHI-25).
        panel.announce(spokenMessage(pack().name, change.entry));
        return;
      }
      panel.chatChanged(change);
      memory.changed();
    },
    () => panel.reveal()
  );
  // Each project's chat is kept in a file of its own, in Mochi's storage
  // folder, and comes back when she opens the project again. With no
  // folder open, it lasts until VS Code closes.
  const chatStore = new ChatStore(vscode.Uri.joinPath(context.globalStorageUri, "chats").fsPath, {
    get: () => context.globalState.get<string>(CHATS_GENERATION),
    set: (value) => context.globalState.update(CHATS_GENERATION, value),
  });
  const memory = new ChatMemory(chatStore, chat);
  void memory.start();
  saveChat = () => memory.flush();
  const clearChat = registerClearChat(chat, memory);
  // The brain is chosen fresh each time she asks: her pick, else Copilot's
  // Auto, else she's asked (MOCHI-53).
  // Her own Claude key, if she adds one, in her system's keychain.
  const claudeKey = new ClaudeKey(context.secrets);
  const claudeModels = new ClaudeModels(claudeKey, context.globalState);
  const brains = new BrainPicker(context.globalState, claudeModels);
  const chooseBrain = brains.register();
  const claudeCommands = registerClaudeKeyCommands(claudeKey, claudeModels, brains);
  // The brain at the top of the chat. Looked up without asking any brain
  // anything, and again whenever brains, her pick, or her key change.
  let brainNow: string | undefined;
  const showBrain = async () => {
    brainNow = await brains.current();
    refreshPanel();
  };
  const followBrain = brains.onDidChange(() => void showBrain());
  void showBrain();
  const conversation = new Conversation(brains, () => instructionsFor(pack(), readLearningMode()), chat, () => chat.saved());
  const explain = registerExplain(conversation, chat);

  // A gentle "Need a paw?" next to an error she's been stuck on (MOCHI-34).
  const stuck = watchStuck();

  // Actions always ask first (MOCHI-31). The late-night nudge offers the
  // same one, in the pack's words.
  const dim = vscode.commands.registerCommand("mochi.dim", () => offer(dimAction(), choose));
  const lateNight = watchLateNight(pack, timer, context.globalState);

  // The greeting when VS Code opens, once a day (MOCHI-33). It waits for a
  // saved focus session to be picked up, so it knows if she's focusing.
  // It shows at the top of the panel when she can see it, otherwise as a
  // fading notification (MOCHI-16).
  const greetingSurface: GreetingSurface = {
    show: (text) =>
      void panel.whenVisible(2_000).then((visible) => (visible ? panel.refresh() : notificationGreeting.show(text))),
  };
  const greeter = new Greeter(context.globalState, pack, () => timer.isRunning(), greetingSurface);

  // Mochi's panel, the "Mochi" tab (MOCHI-16): the cat's mood and today's
  // greeting, quick buttons, and the Ask box, styled only from VS Code's
  // theme.
  // The chip above the box while she has code selected.
  const attachment = new AttachmentChip(() => refreshPanel());
  // Celebrating when she says she finished something (MOCHI-36).
  const party = celebrations({ chat, pack, conversation, attachment, timer });
  const actions = panelActions({
    timer,
    greeter,
    pack,
    conversation,
    chat,
    attachment,
    celebrate: (asked, finished) => party.celebrate(asked, finished),
    setUpCopilot: signInToCopilot,
    brain: () => brainNow,
    hint: (text) => panel.hint(text),
    refresh: () => panel.refresh(),
  });
  const panel: MochiPanel = new MochiPanel(context.extensionUri, actions);
  const home = panel.register();
  refreshPanel = () => panel.refresh();

  // On her first-ever day, the first-run welcome takes the greeting's place
  // (MOCHI-42); never both. It's kept as today's greeting, in the panel.
  const welcomer = new Welcomer(context.globalState, pack, () => timer.isRunning(), () => brains.check(), signInToCopilot, async (text, button) => {
    greeter.keepToday({ day: nightOf(new Date()), text, ...(button ? { button } : {}), welcome: true });
    const visible = await panel.whenVisible(5_000, true);
    panel.refresh();
    return visible;
  });
  const greeted = restored.then(async () => (await welcomer.welcome()) ?? greeter.greet());

  // Copilot is only Mochi's brain: she never needs its own chat. VS Code's
  // setup shows its Chat view in Mochi's place, so once Copilot is ready,
  // Mochi brings her back to its tab and confirms there. A welcome line
  // that said she needed a brain now names it.
  whenCopilotIsReady(async () => {
    const today = greeter.todays();
    if (today.welcome) {
      greeter.keepToday({ day: today.day, text: welcomeText(pack().name, await brains.check()).text, welcome: true });
    }
    await vscode.commands.executeCommand("mochi.open");
    if (await panel.whenVisible(5_000, true)) {
      panel.refresh();
      panel.hint(welcomeStrings.gotABrain);
    } else {
      void vscode.window.showInformationMessage(welcomeStrings.gotABrain);
    }
  });
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
  // never her settings or a saved AI key.
  const forget = registerForgetEverything([
    // Every chat, in every project, on every machine (MOCHI-21).
    { forget: () => memory.forgetAll() },
    { forget: () => personal.forgetAll() },
    { forget: () => greeter.forget() },
    { forget: () => context.globalState.update(LAST_NUDGED, undefined) },
    { forget: () => context.globalState.update(OFFERED, undefined) },
    // Where the list lived before it moved to one store for all projects.
    { forget: () => context.workspaceState.update(OFFERED, undefined) },
    { forget: () => timer.forgetSaved() },
    // The saved list of her Claude models. Her key itself stays.
    { forget: () => claudeModels.forget() },
    // The panel's unsent draft.
    { forget: async () => panel.forget() },
  ]);

  // The "Make it yours" page (MOCHI-43): her name, how Mochi talks, the
  // brain, focus and late night, and her own touches, in one place.
  const yours = new MakeItYours(
    context.extensionUri,
    yoursActions({ brain: () => brains.current(), hasClaudeKey: async () => (await claudeKey.get()) !== undefined })
  );
  const openYours = vscode.commands.registerCommand("mochi.makeItYours", () => yours.open());
  // A change in Settings, or in another window, shows up on the page.
  const followYours = vscode.Disposable.from(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("mochi")) {
        void yours.refresh();
      }
    }),
    // Brains coming or going, and her Claude key.
    brains.onDidChange(() => void yours.refresh())
  );

  // Anything added here is cleaned up when Mochi shuts down.
  context.subscriptions.push(names, claudeKey, claudeCommands, chooseBrain, copilotWatch, open, home, mood, followSpeakUp, focus, timer, explain, stuck, dim, lateNight, coding, python, pythonOffer, forget, memory, followBrain, attachment, clearChat, yours, openYours, followYours);

  return {
    moodText: () => mood.text,
    personal: context.extensionMode === vscode.ExtensionMode.Test ? personal : undefined,
    greeter: context.extensionMode === vscode.ExtensionMode.Test ? greeter : undefined,
    welcomer: context.extensionMode === vscode.ExtensionMode.Test ? welcomer : undefined,
    panel: context.extensionMode === vscode.ExtensionMode.Test ? panel : undefined,
    chat: context.extensionMode === vscode.ExtensionMode.Test ? chat : undefined,
    memory: context.extensionMode === vscode.ExtensionMode.Test ? memory : undefined,
    attachment: context.extensionMode === vscode.ExtensionMode.Test ? attachment : undefined,
    ask: context.extensionMode === vscode.ExtensionMode.Test ? actions.ask : undefined,
  };
}

// Saves the chat one last time, set once Mochi starts.
let saveChat: () => Promise<void> = async () => {};

// VS Code calls this when Mochi shuts down, and waits a moment for the chat
// to be saved.
export function deactivate(): Promise<void> {
  return saveChat();
}
