// The chat in Mochi's panel (MOCHI-21): the messages, and the answer
// surface everything that asks or explains writes to. Plain code with no
// VS Code dependency. The panel shows what's here; nothing here is HTML.
import { AnswerSurface } from "../ai/answerSurface";
import { SavedEntry } from "./chatStore";
import { ChatEntry } from "./messages";

// What changed, so the panel can redraw everything, or only add streamed
// text to one message. "done" says one of Mochi's messages is finished, so
// screen readers can hear it (MOCHI-25).
export type ChatChange = { type: "all" } | { type: "append"; id: number; text: string } | { type: "done"; entry: ChatEntry };

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

  start(asked: string, shared?: string): void {
    this.dropChips();
    const her = this.add("her", asked);
    if (shared) {
      her.shared = shared;
    }
    this.answer(this.add("mochi", ""));
    this.update();
  }

  append(text: string): void {
    if (!this.reply) {
      this.answer(this.add("mochi", ""));
      this.update();
    }
    this.reply!.text += text;
    this.changed({ type: "append", id: this.reply!.id, text });
  }

  finish(): void {
    const reply = this.reply;
    if (reply) {
      reply.answering = undefined;
      this.reply = undefined;
      this.update(false);
      this.changed({ type: "done", entry: reply });
    }
  }

  stopped(): void {
    if (this.reply) {
      this.reply.stopped = true;
    }
    this.finish();
  }

  resume(): void {
    this.dropChips();
    const last = [...this.list].reverse().find((entry) => entry.from === "mochi" && !entry.problem);
    if (last) {
      last.stopped = undefined;
      this.answer(last);
    }
    this.update();
  }

  // Whether Mochi is answering right now, so the box shows Stop.
  answering(): boolean {
    return this.reply !== undefined;
  }

  offerNext(prompt: string, choices: string[]): Promise<string | undefined> {
    const last = this.list[this.list.length - 1];
    if (!last || last.from !== "mochi") {
      return Promise.resolve(undefined);
    }
    return this.offer(last, choices, prompt);
  }

  // Her message and Mochi's own reply, with no AI, like a celebration
  // (MOCHI-36).
  respond(asked: string, line: string): void {
    this.dropChips();
    this.add("her", asked);
    const entry = this.add("mochi", line);
    this.update();
    this.changed({ type: "done", entry });
  }

  say(line: string): void {
    this.dropChips();
    const entry = this.add("mochi", line);
    this.update();
    this.changed({ type: "done", entry });
  }

  async problem(line: string, action?: string): Promise<boolean> {
    this.dropChips();
    const entry = this.add("mochi", line);
    entry.problem = true;
    if (!action) {
      this.update();
      this.changed({ type: "done", entry });
      return false;
    }
    const picked = this.offer(entry, [action]);
    this.changed({ type: "done", entry });
    return (await picked) === action;
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
  // An answer still being written is saved as stopped, so if VS Code closes
  // now, it comes back marked "Stopped"; the next save once it finishes
  // clears that.
  saved(): SavedEntry[] {
    return this.list
      .filter((entry) => entry.text !== "" || entry.stopped)
      .map(({ from, text, problem, shared, stopped, answering }) => ({
        from,
        text,
        ...(problem ? { problem } : {}),
        ...(shared ? { shared } : {}),
        ...(stopped || answering ? { stopped: true } : {}),
      }));
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

  private answer(entry: ChatEntry): void {
    entry.answering = true;
    this.reply = entry;
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
