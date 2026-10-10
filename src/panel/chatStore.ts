// Where each project's chat is kept (MOCHI-21): one file per project, in
// Mochi's private storage folder. Plain code with no VS Code dependency.
//
// Files, not globalState, because globalState loads into memory in every
// window at startup. A file is never written in place: a temp file is
// written, then renamed over it, so a crash can't leave half a chat. A file
// that can't be read means an empty chat, never an error.
//
// The folder lives where Mochi runs, so in a remote setup (SSH, WSL, a
// container) it's on that machine, next to her project. "Forget everything"
// changes a generation kept in globalState, which is always on her own
// computer: a folder written under an older generation is deleted the next
// time Mochi opens it, on any machine. The folder keeps its generation in a
// small file of its own.
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// At most this many messages per project; older ones fall off quietly.
export const MAX_MESSAGES = 200;
// Chats are kept for the projects she used most recently.
export const MAX_PROJECTS = 20;

// One saved message. Chips aren't saved: they're only for the moment.
export interface SavedEntry {
  from: "her" | "mochi";
  text: string;
  problem?: boolean;
  // What was shared with her message, like "lines 9 to 15 of homework.py".
  // Never the code itself.
  shared?: string;
}

// The generation, kept in globalState, where every window on her computer
// can see it, including remote ones.
export interface Generation {
  get(): string | undefined;
  set(value: string): PromiseLike<void>;
}

export type Loaded = {
  entries: SavedEntry[];
  // Unreadable or damaged: the chat starts empty.
  damaged: boolean;
};

const VERSION = 1;
const GENERATION_FILE = "generation";
// Bigger than 200 long answers could ever be: anything larger is damaged.
const MAX_FILE_BYTES = 8_000_000;
const MAX_TEXT = 100_000;
const MAX_SHARED = 500;
const CHAT_FILE = /^[0-9a-f]{32}\.json$/;
const TEMP_FILE = /\.tmp$/;
// A temp file this old was left by a crash.
const STALE_TEMP_MS = 60_000;

// A project's file name, from what identifies it (its folder or workspace
// file). A hash, so no folder name or path shows in Mochi's storage.
export const projectFile = (identity: string): string =>
  `${createHash("sha256").update(identity).digest("hex").slice(0, 32)}.json`;

// A saved message, or undefined if it isn't one.
function toSavedEntry(value: unknown): SavedEntry | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const entry = value as Record<string, unknown>;
  if ((entry.from !== "her" && entry.from !== "mochi") || typeof entry.text !== "string" || entry.text.length > MAX_TEXT) {
    return undefined;
  }
  if (entry.problem !== undefined && typeof entry.problem !== "boolean") {
    return undefined;
  }
  if (entry.shared !== undefined && (typeof entry.shared !== "string" || entry.shared.length > MAX_SHARED)) {
    return undefined;
  }
  return {
    from: entry.from,
    text: entry.text,
    ...(entry.problem ? { problem: true } : {}),
    ...(typeof entry.shared === "string" ? { shared: entry.shared } : {}),
  };
}

// A whole file, or undefined if anything about it is wrong.
export function toSavedChat(text: string): SavedEntry[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  const chat = parsed as { version?: unknown; messages?: unknown } | null;
  if (typeof chat !== "object" || chat === null || chat.version !== VERSION || !Array.isArray(chat.messages)) {
    return undefined;
  }
  const entries = chat.messages.map(toSavedEntry);
  return entries.every((entry) => entry !== undefined) ? (entries as SavedEntry[]).slice(-MAX_MESSAGES) : undefined;
}

const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";

// Generations count up, so a window whose view of globalState is a moment
// behind can never undo a "Forget everything".
const toGeneration = (value: unknown): number => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
};

export class ChatStore {
  constructor(
    // Mochi's own folder for chats, like <globalStorageUri>/chats.
    private readonly folder: string,
    private readonly generation: Generation
  ) {}

  // Loads a project's chat. `since` is the generation it belongs to: pass
  // it back to save().
  async load(identity: string): Promise<Loaded & { since: number }> {
    const since = await this.catchUp();
    let text: string;
    try {
      const file = path.join(this.folder, projectFile(identity));
      if ((await fs.stat(file)).size > MAX_FILE_BYTES) {
        return { entries: [], damaged: true, since };
      }
      text = await fs.readFile(file, "utf8");
    } catch (error) {
      return { entries: [], damaged: !missing(error), since };
    }
    const entries = toSavedChat(text);
    return entries ? { entries, damaged: false, since } : { entries: [], damaged: true, since };
  }

  // Saves a project's chat, unless chats were forgotten since it was
  // loaded, in this window or another one: then nothing is written, so an
  // old chat can't come back. Throws if it can't be saved, like on a full
  // disk; nothing is half written either way.
  async save(identity: string, entries: readonly SavedEntry[], since: number): Promise<"saved" | "forgotten"> {
    if ((await this.catchUp()) !== since) {
      return "forgotten";
    }
    const kept = entries
      .slice(-MAX_MESSAGES)
      .map(toSavedEntry)
      .filter((entry) => entry !== undefined);
    await this.writeAtomically(projectFile(identity), JSON.stringify({ version: VERSION, messages: kept }));
    await this.prune(projectFile(identity));
    return "saved";
  }

  // Whether chats were forgotten since `since`, without changing anything.
  async forgottenSince(since: number): Promise<boolean> {
    const written = await this.folderGeneration();
    return written === undefined || written > since || toGeneration(this.generation.get()) > since;
  }

  // "Clear chat": this project's file goes.
  async clear(identity: string): Promise<void> {
    await fs.rm(path.join(this.folder, projectFile(identity)), { force: true });
  }

  // "Forget everything": the folder goes, and a new generation is kept in
  // globalState and in a fresh, empty folder. Folders on other machines are
  // deleted the next time Mochi opens them. Returns the new generation.
  async forgetAll(): Promise<number> {
    const next = Math.max(toGeneration(this.generation.get()), (await this.folderGeneration()) ?? 0) + 1;
    await this.generation.set(String(next));
    await fs.rm(this.folder, { recursive: true, force: true });
    await this.writeAtomically(GENERATION_FILE, String(next));
    return next;
  }

  // A folder written under an older generation was forgotten: it goes.
  // Returns the generation the folder now belongs to.
  private async catchUp(): Promise<number> {
    const current = toGeneration(this.generation.get());
    const written = await this.folderGeneration();
    if (written !== undefined && written >= current) {
      return written;
    }
    if (written !== undefined) {
      await fs.rm(this.folder, { recursive: true, force: true });
    }
    await this.writeAtomically(GENERATION_FILE, String(current));
    return current;
  }

  private async folderGeneration(): Promise<number | undefined> {
    try {
      return toGeneration(await fs.readFile(path.join(this.folder, GENERATION_FILE), "utf8"));
    } catch {
      return undefined;
    }
  }

  private async writeAtomically(name: string, text: string): Promise<void> {
    await fs.mkdir(this.folder, { recursive: true });
    const target = path.join(this.folder, name);
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp, text, "utf8");
      await renameWithRetry(temp, target);
    } catch (error) {
      await fs.rm(temp, { force: true });
      throw error;
    }
  }

  // Keeps the chats of the MAX_PROJECTS projects used most recently, and
  // cleans up temp files a crash left behind.
  private async prune(keep: string): Promise<void> {
    const now = Date.now();
    const chats: { name: string; at: number }[] = [];
    for (const name of await fs.readdir(this.folder)) {
      const file = path.join(this.folder, name);
      try {
        const { mtimeMs } = await fs.stat(file);
        if (TEMP_FILE.test(name) && now - mtimeMs > STALE_TEMP_MS) {
          await fs.rm(file, { force: true });
        } else if (CHAT_FILE.test(name) && name !== keep) {
          chats.push({ name, at: mtimeMs });
        }
      } catch {
        // Gone already, maybe removed by another window.
      }
    }
    chats.sort((a, b) => b.at - a.at);
    for (const old of chats.slice(MAX_PROJECTS - 1)) {
      await fs.rm(path.join(this.folder, old.name), { force: true });
    }
  }
}

// On Windows, a virus scanner or another window reading the file can block
// a rename for a moment.
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (attempt >= 3 || (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY")) {
        throw error;
      }
      await new Promise((done) => setTimeout(done, 50 * attempt));
    }
  }
}
