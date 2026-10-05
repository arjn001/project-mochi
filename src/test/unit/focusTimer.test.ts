import * as assert from "node:assert";
import { FocusTimer, STORE_KEY, Store, toFocusMinutes } from "../../focus/timer";
import { moodLine } from "../../presence/mood";

// A fake clock and timer: time only moves when the test says so.
function fakeTime() {
  let now = 0;
  let pending: { at: number; callback: () => void } | undefined;
  return {
    now: () => now,
    schedule: (callback: () => void, ms: number) => {
      pending = { at: now + ms, callback };
      return () => (pending = undefined);
    },
    advanceMinutes(minutes: number) {
      now += minutes * 60_000;
      if (pending && pending.at <= now) {
        const { callback } = pending;
        pending = undefined;
        callback();
      }
    },
  };
}

// A fake globalState, which keeps its contents across "reloads".
function fakeStore(): Store & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: <T>(key: string) => data.get(key) as T | undefined,
    update: async (key: string, value: unknown) => void (value === undefined ? data.delete(key) : data.set(key, value)),
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("focus timer", () => {
  it("counts down in whole minutes, never seconds", async () => {
    const time = fakeTime();
    const timer = new FocusTimer(fakeStore(), time.now, time.schedule);
    await timer.start(25);
    assert.strictEqual(timer.minutesLeft(), 25);
    time.advanceMinutes(6.5);
    assert.strictEqual(timer.minutesLeft(), 19, "18.5 minutes left rounds up to 19.");
  });

  it("ends on time and tells Mochi, once", async () => {
    const time = fakeTime();
    const timer = new FocusTimer(fakeStore(), time.now, time.schedule);
    let ends = 0;
    timer.onEnd(() => ends++);
    await timer.start(25);
    time.advanceMinutes(24);
    assert.strictEqual(ends, 0);
    time.advanceMinutes(1);
    await settle();
    assert.strictEqual(ends, 1);
    assert.strictEqual(timer.isRunning(), false);
  });

  it("stopping it doesn't count as time's up", async () => {
    const time = fakeTime();
    const timer = new FocusTimer(fakeStore(), time.now, time.schedule);
    let ends = 0;
    timer.onEnd(() => ends++);
    await timer.start(25);
    await timer.stop();
    time.advanceMinutes(30);
    assert.strictEqual(ends, 0);
    assert.strictEqual(timer.isRunning(), false);
  });

  it("survives a VS Code reload", async () => {
    const time = fakeTime();
    const store = fakeStore();
    await new FocusTimer(store, time.now, time.schedule).start(25);
    time.advanceMinutes(10);

    const afterReload = new FocusTimer(store, time.now, time.schedule);
    await afterReload.restore();
    assert.strictEqual(afterReload.minutesLeft(), 15);
  });

  it("quietly clears a session that ended while VS Code was closed", async () => {
    const time = fakeTime();
    const store = fakeStore();
    await new FocusTimer(store, time.now, time.schedule).start(25);
    time.advanceMinutes(40);

    const afterReload = new FocusTimer(store, time.now, time.schedule);
    let ends = 0;
    afterReload.onEnd(() => ends++);
    await afterReload.restore();
    assert.strictEqual(afterReload.isRunning(), false);
    assert.strictEqual(ends, 0, "She wasn't here, so no time's-up message.");
    assert.strictEqual(store.data.has(STORE_KEY), false);
  });

  it("uses 25 minutes for anything unexpected in Settings", () => {
    assert.strictEqual(toFocusMinutes(45), 45);
    assert.strictEqual(toFocusMinutes("lots"), 25);
    assert.strictEqual(toFocusMinutes(undefined), 25);
    assert.strictEqual(toFocusMinutes(1), 5, "At least 5 minutes.");
    assert.strictEqual(toFocusMinutes(999), 120, "At most 2 hours.");
  });
});

describe("mood line during a focus session", () => {
  it("shows the minutes left, with no seconds", () => {
    assert.strictEqual(moodLine("gentle", "purring", 18).text, "$(mochi-here) Focusing · 18 min left");
  });

  it("still shows in quiet mode, since she started it", () => {
    assert.strictEqual(moodLine("quiet", "purring", 18).text, "$(mochi-here) Focusing · 18 min left");
    assert.strictEqual(moodLine("quiet", "purring").text, "$(mochi-napping) Mochi is napping");
  });
});
