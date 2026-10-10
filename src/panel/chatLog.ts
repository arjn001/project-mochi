// The chat in Mochi's panel (MOCHI-21): the messages, and the answer
// surface everything that asks or explains writes to. Plain code with no
// VS Code dependency. The panel shows what's here; nothing here is HTML.
import { AnswerSurface } from "../ai/answerSurface";
import { SavedEntry } from "./chatStore";
import { ChatEntry } from "./messages";

// What changed, so the panel can redraw everything, or only add streamed
// text to one message.
export type ChatChange = { type: "all" } | { type: "append"; id: number; text: string };

export class ChatLog implements AnswerSurface {
  private list: ChatEntry[] = [];
  private nextId = 1;
  // The answer being written.
  private reply: ChatEntry | undefined;
  // Chips waiting for her click. Only the newest ones can be picked.
  private waiting: { entry: ChatEntry; resolve: (label: string | undefined) => void } | undefined;

  constructor(
    private readonly changed: (change: ChatChange) => void = () => {},
    // Shows the chat, like when the lightbulb's "Explain with Mochi" is
    // clicked while the panel is closed.
    private readonly reveal: () => void = () => {}
  ) {}

  entries(): readonly ChatEntry[] {
    return this.list;
  }

  start(asked: string): void {
    this.dropChips();
    this.add("her", asked);
    this.reply = this.add("mochi", "");
    this.update();
  }

  append(text: string): void {
    if (!this.reply) {
      this.reply = this.add("mochi", "");
      this.update();
    }
    this.reply.text += text;
    this.changed({ type: "append", id: this.reply.id, text });
  }

  finish(): void {
    this.reply = undefined;
  }

  resume(): void {
    this.dropChips();
    this.reply = [...this.list].reverse().find((entry) => entry.from === "mochi" && !entry.problem);
    this.update();
  }

  offerNext(prompt: string, choices: string[]): Promise<string | undefined> {
    const last = this.list[this.list.length - 1];
    if (!last || last.from !== "mochi") {
      return Promise.resolve(undefined);
    }
    return this.offer(last, choices, prompt);
  }

  say(line: string): void {
    this.dropChips();
    this.add("mochi", line);
    this.update();
  }

  async problem(line: string, action?: string): Promise<boolean> {
    this.dropChips();
    const entry = this.add("mochi", line);
    entry.problem = true;
    if (!action) {
      this.update();
      return false;
    }
    return (await this.offer(entry, [action])) === action;
  }

  // Her click on a chip. Old chips, or anything unknown, do nothing.
  choose(entryId: number, chipId: string): void {
    const waiting = this.waiting;
    const label = waiting?.entry.id === entryId ? waiting.entry.chips?.choices.find((c) => c.id === chipId)?.label : undefined;
    if (waiting && label !== undefined) {
      this.waiting = undefined;
      waiting.entry.chips = undefined;
      this.update(false);
      waiting.resolve(label);
    }
  }

  clear(): void {
    this.dropChips();
    this.list = [];
    this.reply = undefined;
    this.update(false);
  }

  // A saved chat, put before anything said since Mochi started, so a
  // question asked while it loaded isn't lost. Doesn't show the panel.
  restore(saved: readonly SavedEntry[]): void {
    const before = saved.map((entry) => ({ ...entry, id: this.nextId++ }));
    this.list = [...before, ...this.list];
    this.update(false);
  }

  // What's kept on disk: every message with something in it, without chips.
  saved(): SavedEntry[] {
    return this.list
      .filter((entry) => entry.text !== "")
      .map(({ from, text, problem, shared }) => ({ from, text, ...(problem ? { problem } : {}), ...(shared ? { shared } : {}) }));
  }

  private offer(entry: ChatEntry, choices: string[], prompt?: string): Promise<string | undefined> {
    this.dropChips();
    entry.chips = { ...(prompt ? { prompt } : {}), choices: choices.map((label, i) => ({ id: String(i), label })) };
    this.update();
    return new Promise((resolve) => {
      this.waiting = { entry, resolve };
    });
  }

  // When she moves on, chips she didn't pick go away, as a notification
  // closing would.
  private dropChips(): void {
    const waiting = this.waiting;
    if (waiting) {
      this.waiting = undefined;
      waiting.entry.chips = undefined;
      waiting.resolve(undefined);
    }
  }

  private add(from: ChatEntry["from"], text: string): ChatEntry {
    const entry: ChatEntry = { id: this.nextId++, from, text };
    this.list.push(entry);
    return entry;
  }

  // New messages show the chat; clearing it or a click on a chip don't.
  private update(reveal = true): void {
    if (reveal) {
      this.reveal();
    }
    this.changed({ type: "all" });
  }
}
