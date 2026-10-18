import * as assert from "node:assert";
import { loadDefaultPack } from "../../packs/defaultPack";
import { layerOver } from "../../packs/format";
import { greeting } from "../../packs/phrases";
import {
  GreetCheck,
  cleanProjectName,
  greetingText,
  shortProjectName,
  shouldGreet,
  shouldSaveCoding,
  toLastCoding,
} from "../../moments/greeting";

const pack = loadDefaultPack();
const evening = new Date(2026, 9, 6, 19, 0);
const hours = (n: number) => n * 60 * 60_000;
const first = () => 0;

// Gentle, not focusing, not greeted yet today. Tests change one thing.
const check = (overrides: Partial<GreetCheck> = {}): GreetCheck => ({
  now: evening,
  speakUp: "gentle",
  focusing: false,
  lastGreetedDay: undefined,
  ...overrides,
});

describe("the greeting when VS Code opens", () => {
  describe("when", () => {
    it("greets once a day, across all her windows", () => {
      assert.strictEqual(shouldGreet(check()), true);
      assert.strictEqual(shouldGreet(check({ lastGreetedDay: "2026-10-06" })), false);
      assert.strictEqual(shouldGreet(check({ lastGreetedDay: "2026-10-05" })), true);
    });

    it("counts 1:00 as the same night, so 20:00 and 1:00 don't both get a greeting", () => {
      assert.strictEqual(shouldGreet(check({ now: new Date(2026, 9, 7, 1, 0), lastGreetedDay: "2026-10-06" })), false);
    });

    it("never greets in quiet mode or during a focus session", () => {
      assert.strictEqual(shouldGreet(check({ speakUp: "quiet" })), false);
      assert.strictEqual(shouldGreet(check({ focusing: true })), false);
    });

    it("greets once a day in chatty mode too", () => {
      assert.strictEqual(shouldGreet(check({ speakUp: "chatty", lastGreetedDay: "2026-10-06" })), false);
    });
  });

  describe("what it says", () => {
    const say = (last: { at: number; project?: string } | undefined, project?: string) =>
      greetingText(pack, { now: evening, lateHour: 23, last, project, random: first });

    // The day's greeting, from the pack. The tests check which parts come
    // after it, not the wording (MOCHI-70).
    const hello = greeting(pack, evening, first, 23);
    const welcomeBack = pack.phrases.welcomeBack[0];

    it("is just the greeting the first time, or the same day", () => {
      assert.strictEqual(say(undefined), hello);
      assert.strictEqual(say({ at: evening.getTime() - hours(5) }), hello);
    });

    it("welcomes her back warmly after 2 or more days, never counting them", () => {
      assert.strictEqual(say({ at: evening.getTime() - hours(47) }), hello);
      const back = say({ at: evening.getTime() - hours(72) });
      assert.strictEqual(back, `${hello} ${welcomeBack}`);
      assert.doesNotMatch(back, /\d/);
    });

    it("asks about her project only when she opens the one she last coded in", () => {
      const recent = evening.getTime() - hours(3);
      assert.match(say({ at: recent, project: "homework-3" }, "homework-3"), /Back to homework-3\?$/);
      assert.doesNotMatch(say({ at: recent, project: "homework-3" }, "lab-2"), /homework-3|lab-2/);
      assert.doesNotMatch(say({ at: recent, project: "homework-3" }, undefined), /Back to/);
    });

    it("can say all three, still short", () => {
      const text = say({ at: evening.getTime() - hours(72), project: "homework-3" }, "homework-3");
      assert.strictEqual(text, "Meow, good evening! What are we making today? Welcome back! I missed you. Back to homework-3?");
    });

    it("uses her name and her own lines from her personal layer", () => {
      const hers = layerOver(pack, {
        format: 1,
        user: { name: "Sam" },
        phrases: { greeting: ["Hi {name}!"], backToProject: ["{project} time?"] },
      });
      const text = greetingText(hers, {
        now: evening,
        lateHour: 23,
        last: { at: evening.getTime() - hours(1), project: "lab" },
        project: "lab",
        random: first,
      });
      assert.strictEqual(text, "Hi Sam! lab time?");
    });

    it("treats the project name as plain text, and shortens long ones", () => {
      const recent = evening.getTime() - hours(1);
      assert.match(say({ at: recent, project: "{name}" }, "{name}"), /Back to \{name\}\?$/);
      assert.strictEqual(shortProjectName("x".repeat(40)), `${"x".repeat(29)}…`);
    });
  });

  describe("remembering when she last coded", () => {
    it("saves at most once a minute, not on every keystroke", () => {
      assert.ok(shouldSaveCoding(undefined, 0));
      assert.ok(!shouldSaveCoding(0, 59_000));
      assert.ok(shouldSaveCoding(0, 60_000));
    });

    it("ignores anything unexpected in storage", () => {
      assert.deepStrictEqual(toLastCoding({ at: 5, project: "lab" }), { at: 5, project: "lab" });
      assert.deepStrictEqual(toLastCoding({ at: 5, project: 42 }), { at: 5 });
      for (const bad of [undefined, null, "yesterday", { at: "5" }, { at: Infinity }]) {
        assert.strictEqual(toLastCoding(bad), undefined);
      }
    });

    it("keeps only the folder's name, without remote or workspace suffixes", () => {
      assert.strictEqual(cleanProjectName("homework-3"), "homework-3");
      assert.strictEqual(cleanProjectName("homework-3 [SSH: lab-server]"), "homework-3");
      assert.strictEqual(cleanProjectName("cs101 (Workspace)"), "cs101");
      assert.strictEqual(cleanProjectName("Untitled (Workspace)"), undefined);
      assert.strictEqual(cleanProjectName(undefined), undefined);
    });
  });
});
