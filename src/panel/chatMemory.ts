import * as vscode from "vscode";
import { chatStrings } from "../strings";
import { ChatLog } from "./chatLog";
import { ChatStore } from "./chatStore";

// Where the chats' generation is kept, in globalState (see chatStore.ts).
export const CHATS_GENERATION = "mochi.chatsGeneration";

// How long after the last change the chat is saved, so a streaming answer
// is written once it settles, not with every word.
const SAVE_AFTER_MS = 500;

// What identifies this project: its workspace file, or its folders. With no
// folder open, nothing: the chat lasts until VS Code closes.
export function projectIdentity(): string | undefined {
  const file = vscode.workspace.workspaceFile;
  if (file && file.scheme !== "untitled") {
    return file.toString();
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders.length > 0 ? folders.map((folder) => folder.uri.toString()).sort().join("\n") : undefined;
}

// Keeps the chat on disk for each project (MOCHI-21): brings it back when
// Mochi starts, saves it as it changes, follows the folders she opens, and
// notices "Forget everything" from another window.
export class ChatMemory implements vscode.Disposable {
  private identity = projectIdentity();
  // The generation the chat in memory belongs to (see chatStore.ts).
  private since = 0;
  private loaded = false;
  // False if Mochi's folder couldn't be used when the chat loaded.
  private usable = false;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  // Saves run one at a time, in order.
  private saving: Promise<void> = Promise.resolve();
  // The "couldn't save" line, once per session.
  private told = false;
  // While Mochi itself empties the chat, which needs no save.
  private muted = false;
  private readonly listeners: vscode.Disposable[];

  constructor(
    private readonly store: ChatStore,
    private readonly chat: ChatLog
  ) {
    this.listeners = [
      vscode.workspace.onDidChangeWorkspaceFolders(() => void this.followProject()),
      // Back from another window, where she may have forgotten everything.
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
          void this.checkForgotten();
        }
      }),
    ];
  }

  // Brings this project's chat back. Anything asked while it loaded stays,
  // after it.
  async start(): Promise<void> {
    await this.load();
  }

  // The chat changed: save it soon.
  changed(): void {
    if (this.muted) {
      return;
    }
    this.dirty = true;
    if (!this.loaded) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_AFTER_MS);
  }

  // Saves now if anything changed, like when Mochi shuts down.
  flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.dirty || !this.loaded) {
      return this.saving;
    }
    this.dirty = false;
    const identity = this.identity;
    const entries = this.chat.saved();
    const since = this.since;
    this.saving = this.saving.then(async () => {
      if (!identity) {
        return;
      }
      try {
        if ((await this.store.save(identity, entries, since)) === "forgotten") {
          // Already inside the save chain, so no waiting for it.
          this.emptyNow();
          this.since = await this.store.generationNow();
        }
      } catch {
        if (!this.told) {
          this.told = true;
          this.chat.say(chatStrings.couldntSave);
        }
      }
    });
    return this.saving;
  }

  // "Clear chat": this project's chat, on disk and on screen.
  async clear(): Promise<void> {
    await this.emptyChat();
    if (this.identity) {
      await this.store.clear(this.identity);
    }
  }

  // "Forget everything": every chat, in every project, on every machine
  // (see chatStore.ts).
  async forgetAll(): Promise<void> {
    await this.emptyChat();
    this.since = await this.store.forgetAll();
  }

  dispose(): void {
    clearTimeout(this.timer);
    for (const listener of this.listeners) {
      listener.dispose();
    }
  }

  private async load(): Promise<void> {
    this.loaded = false;
    this.usable = false;
    try {
      if (this.identity) {
        const saved = await this.store.load(this.identity);
        this.since = saved.since;
        // A damaged file shows as an empty chat, with the usual empty line.
        // Restoring it needs no save; only what she asked meanwhile does.
        this.muted = true;
        try {
          this.chat.restore(saved.entries);
        } finally {
          this.muted = false;
        }
      } else {
        this.since = await this.store.generationNow();
      }
      this.usable = true;
    } catch {
      // Mochi's folder can't be used at all: the chat lasts the session,
      // and the first save says so.
    }
    this.loaded = true;
    if (this.dirty) {
      this.changed();
    }
  }

  // She opened or closed folders: save this project's chat, then show the
  // new project's.
  private async followProject(): Promise<void> {
    const next = projectIdentity();
    if (next === this.identity) {
      return;
    }
    await this.flush();
    this.identity = next;
    await this.emptyChat();
    await this.load();
  }

  private async checkForgotten(): Promise<void> {
    if (!this.loaded || !this.usable) {
      return;
    }
    try {
      if (await this.store.forgottenSince(this.since)) {
        await this.wasForgotten();
      }
    } catch {
      // Checked again next time.
    }
  }

  // "Forget everything" happened in another window: this one's chat goes
  // too, and the chat picks up from the new generation.
  private async wasForgotten(): Promise<void> {
    await this.emptyChat();
    this.since = await this.store.generationNow();
  }

  // Empties the chat on screen, after any save in progress, without saving
  // the empty chat.
  private async emptyChat(): Promise<void> {
    clearTimeout(this.timer);
    this.dirty = false;
    await this.saving;
    this.emptyNow();
  }

  private emptyNow(): void {
    clearTimeout(this.timer);
    this.dirty = false;
    this.muted = true;
    try {
      this.chat.clear();
    } finally {
      this.muted = false;
    }
  }
}
