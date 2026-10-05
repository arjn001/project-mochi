import * as assert from "node:assert";
import { LateNightCheck, isLate, lateNightNudge, nightOf, toLateHour } from "../../moments/lateNight";
import { timeOfDay } from "../../packs/phrases";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

// A late, gentle, light-themed night with no nudge yet. Tests change one thing.
const tonight = (overrides: Partial<LateNightCheck> = {}): LateNightCheck => ({
  now: at(5, 23, 30),
  lateHour: 23,
  speakUp: "gentle",
  lastNudgedNight: undefined,
  focusing: false,
  theme: "light",
  ...overrides,
});

describe("late night", () => {
  describe("when it's late", () => {
    it("runs from the late hour until 5:00", () => {
      for (const hour of [23, 0, 2, 4]) assert.ok(isLate(hour, 23), `${hour}:00 is late`);
      for (const hour of [5, 12, 22]) assert.ok(!isLate(hour, 23), `${hour}:00 isn't late`);
    });

    it("follows the late-hour setting, including one after midnight", () => {
      assert.ok(isLate(21, 21));
      assert.ok(!isLate(20, 21));
      // A late hour of 1 means only 1:00 to 5:00, not the whole day.
      assert.ok(isLate(2, 1));
      for (const hour of [0, 5, 12, 23]) assert.ok(!isLate(hour, 1), `${hour}:00 isn't late with a 1:00 late hour`);
    });

    it("greets the night owl from the late-hour setting too", () => {
      assert.strictEqual(timeOfDay(21, 21), "late");
      assert.strictEqual(timeOfDay(21, 23), "evening");
    });

    it("uses 23:00 for anything unexpected in Settings", () => {
      assert.strictEqual(toLateHour(21), 21);
      for (const bad of [24, -1, 22.5, "late", undefined]) assert.strictEqual(toLateHour(bad), 23);
    });
  });

  describe("one nudge per night", () => {
    it("counts the hours after midnight as the same night", () => {
      assert.strictEqual(nightOf(at(5, 23, 30)), "2026-10-05");
      assert.strictEqual(nightOf(at(6, 1, 30)), "2026-10-05");
      assert.strictEqual(nightOf(at(6, 23, 30)), "2026-10-06");
    });

    it("doesn't nudge again once she's been nudged tonight", () => {
      assert.strictEqual(lateNightNudge(tonight({ now: at(6, 1, 30), lastNudgedNight: "2026-10-05" })), undefined);
      assert.strictEqual(lateNightNudge(tonight({ now: at(6, 23, 30), lastNudgedNight: "2026-10-05" })), "dim");
    });
  });

  describe("the nudge", () => {
    it("offers to dim a light theme", () => {
      assert.strictEqual(lateNightNudge(tonight()), "dim");
    });

    it("only keeps her company on a dark or high contrast theme", () => {
      assert.strictEqual(lateNightNudge(tonight({ theme: "dark" })), "company");
      assert.strictEqual(lateNightNudge(tonight({ theme: "highContrast" })), "company");
    });

    it("never happens before the late hour", () => {
      assert.strictEqual(lateNightNudge(tonight({ now: at(5, 22, 59) })), undefined);
    });

    it("never happens in quiet mode", () => {
      assert.strictEqual(lateNightNudge(tonight({ speakUp: "quiet" })), undefined);
    });

    it("waits while a focus session is running", () => {
      assert.strictEqual(lateNightNudge(tonight({ focusing: true })), undefined);
      assert.strictEqual(lateNightNudge(tonight({ focusing: false })), "dim");
    });
  });
});
