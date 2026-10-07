// The focus timer (MOCHI-29). Plain code with no VS Code dependency: the
// clock, the timer, and the storage are passed in, so tests can use fakes.

export const DEFAULT_FOCUS_MINUTES = 25;
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

export const STORE_KEY = "mochi.focusEndsAt";

type Schedule = (callback: () => void, ms: number) => () => void;

const realSchedule: Schedule = (callback, ms) => {
  const handle = setTimeout(callback, ms);
  return () => clearTimeout(handle);
};

export class FocusTimer {
  private endsAt: number | undefined;
  private cancel: (() => void) | undefined;
  private readonly changed: (() => void)[] = [];
  private readonly ended: (() => void)[] = [];

  constructor(
    private readonly store: Store,
    private readonly now: () => number = Date.now,
    private readonly schedule: Schedule = realSchedule
  ) {}

  // Called whenever a session starts, stops, or ends.
  onChange(listener: () => void): void {
    this.changed.push(listener);
  }

  // Called when time runs out while she's here (not when she stops it).
  onEnd(listener: () => void): void {
    this.ended.push(listener);
  }

  // Picks up a session saved before a reload. One that ended while VS Code
  // was closed is cleared quietly, since she wasn't here to see it.
  async restore(): Promise<void> {
    const saved = this.store.get<number>(STORE_KEY);
    if (saved !== undefined && saved > this.now()) {
      this.endsAt = saved;
      this.arm();
      this.emit(this.changed);
    } else if (saved !== undefined) {
      await this.store.update(STORE_KEY, undefined);
    }
  }

  async start(minutes: number): Promise<void> {
    this.endsAt = this.now() + toFocusMinutes(minutes) * 60_000;
    await this.store.update(STORE_KEY, this.endsAt);
    this.arm();
    this.emit(this.changed);
  }

  async stop(): Promise<void> {
    await this.clear();
    this.emit(this.changed);
  }

  isRunning(): boolean {
    return this.endsAt !== undefined;
  }

  // Whole minutes left, rounded up, so it never says "0 min left" early.
  minutesLeft(): number | undefined {
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
    await this.clear();
    this.emit(this.changed);
    this.emit(this.ended);
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
    await this.store.update(STORE_KEY, undefined);
  }

  private emit(listeners: (() => void)[]): void {
    for (const listener of listeners) {
      listener();
    }
  }
}
