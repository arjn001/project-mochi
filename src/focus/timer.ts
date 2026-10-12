// The focus timer (MOCHI-29). Plain code with no VS Code dependency: the
// clock, the timer, and the storage are passed in, so tests can use fakes.

export const DEFAULT_FOCUS_MINUTES = 25;
// A break after she finishes something (MOCHI-36).
export const BREAK_MINUTES = 5;
export const MIN_FOCUS_MINUTES = 5;
export const MAX_FOCUS_MINUTES = 120;

// Settings can be typed by hand, so anything unexpected falls back to 25.
export function toFocusMinutes(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, Math.round(value)))
    : DEFAULT_FOCUS_MINUTES;
}

// Where the end time is kept, so a session survives a VS Code reload.
// VS Code's globalState fits this shape.
export interface Store {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

// A focus session's end time, as a number (what older versions saved), or a
// break's, as { endsAt, kind: "break" }.
export const STORE_KEY = "mochi.focusEndsAt";

export type TimerKind = "focus" | "break";

// What was saved, or undefined if it isn't anything Mochi saved.
function toSaved(value: unknown): { endsAt: number; kind: TimerKind } | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { endsAt: value, kind: "focus" };
  }
  const saved = value as { endsAt?: unknown; kind?: unknown } | null;
  if (typeof saved === "object" && saved !== null && typeof saved.endsAt === "number" && Number.isFinite(saved.endsAt) && saved.kind === "break") {
    return { endsAt: saved.endsAt, kind: "break" };
  }
  return undefined;
}

type Schedule = (callback: () => void, ms: number) => () => void;

const realSchedule: Schedule = (callback, ms) => {
  const handle = setTimeout(callback, ms);
  return () => clearTimeout(handle);
};

// The focus timer, and the same clock for a short break (MOCHI-36). Only one
// runs at a time: starting one ends the other.
export class FocusTimer {
  private endsAt: number | undefined;
  private kind: TimerKind | undefined;
  private cancel: (() => void) | undefined;
  private readonly changed: (() => void)[] = [];
  private readonly ended: ((kind: TimerKind) => void)[] = [];

  constructor(
    private readonly store: Store,
    private readonly now: () => number = Date.now,
    private readonly schedule: Schedule = realSchedule
  ) {}

  // Called whenever a session starts, stops, or ends.
  onChange(listener: () => void): void {
    this.changed.push(listener);
  }

  // Called when time runs out while she's here (not when she stops it),
  // with whether it was a focus session or a break.
  onEnd(listener: (kind: TimerKind) => void): void {
    this.ended.push(listener);
  }

  // Picks up a session saved before a reload. One that ended while VS Code
  // was closed is cleared quietly, since she wasn't here to see it.
  async restore(): Promise<void> {
    const raw = this.store.get<unknown>(STORE_KEY);
    const saved = toSaved(raw);
    if (saved && saved.endsAt > this.now()) {
      this.endsAt = saved.endsAt;
      this.kind = saved.kind;
      this.arm();
      this.emit(this.changed);
    } else if (raw !== undefined) {
      await this.store.update(STORE_KEY, undefined);
    }
  }

  async start(minutes: number): Promise<void> {
    this.endsAt = this.now() + toFocusMinutes(minutes) * 60_000;
    this.kind = "focus";
    await this.store.update(STORE_KEY, this.endsAt);
    this.arm();
    this.emit(this.changed);
  }

  // A short break she asked for, shown in the mood line.
  async startBreak(minutes: number = BREAK_MINUTES): Promise<void> {
    this.endsAt = this.now() + minutes * 60_000;
    this.kind = "break";
    await this.store.update(STORE_KEY, { endsAt: this.endsAt, kind: "break" });
    this.arm();
    this.emit(this.changed);
  }

  async stop(): Promise<void> {
    await this.clear();
    this.emit(this.changed);
  }

  // Whether a focus session is running. A break isn't one, so it never
  // holds back the greeting or an offer.
  isRunning(): boolean {
    return this.kind === "focus";
  }

  // Whether the focus session or the break is ticking, for the mood line.
  isTicking(): boolean {
    return this.endsAt !== undefined;
  }

  // A focus session's whole minutes left, rounded up, so it never says
  // "0 min left" early.
  minutesLeft(): number | undefined {
    return this.kind === "focus" ? this.left() : undefined;
  }

  // A break's minutes left, the same way.
  breakMinutesLeft(): number | undefined {
    return this.kind === "break" ? this.left() : undefined;
  }

  private left(): number | undefined {
    return this.endsAt === undefined ? undefined : Math.max(1, Math.ceil((this.endsAt - this.now()) / 60_000));
  }

  dispose(): void {
    this.cancel?.();
  }

  private arm(): void {
    this.cancel?.();
    this.cancel = this.schedule(() => void this.finish(), Math.max(0, (this.endsAt ?? 0) - this.now()));
  }

  private async finish(): Promise<void> {
    const kind = this.kind ?? "focus";
    await this.clear();
    this.emit(this.changed);
    for (const listener of this.ended) {
      listener(kind);
    }
  }

  // For "Forget everything": a session that's running keeps going, since
  // she started it, but its saved end time is gone, so it won't come back
  // after a restart.
  async forgetSaved(): Promise<void> {
    await this.store.update(STORE_KEY, undefined);
  }

  private async clear(): Promise<void> {
    this.cancel?.();
    this.cancel = undefined;
    this.endsAt = undefined;
    this.kind = undefined;
    await this.store.update(STORE_KEY, undefined);
  }

  private emit(listeners: (() => void)[]): void {
    for (const listener of listeners) {
      listener();
    }
  }
}
