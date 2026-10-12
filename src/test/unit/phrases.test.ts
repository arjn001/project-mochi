import * as assert from "node:assert";
import { layerOver } from "../../packs/format";
import { loadDefaultPack } from "../../packs/defaultPack";
import { greeting, pickPhrase, timeOfDay } from "../../packs/phrases";

const pack = loadDefaultPack();
const withName = layerOver(pack, { format: 1, user: { name: "Sam" } });

// Every possible pick, by stepping `random` through each line.
function everyPick(make: (random: () => number) => string, count = 10): string[] {
  return Array.from({ length: count }, (_, i) => make(() => i / count));
}

const at = (hour: number, minute = 0) => new Date(2026, 9, 5, hour, minute);

describe("phrases", () => {
  describe("time of day", () => {
    it("is only ever morning, afternoon, evening, or late", () => {
      for (let hour = 0; hour < 24; hour++) {
        assert.ok(["morning", "afternoon", "evening", "late"].includes(timeOfDay(hour)), `hour ${hour}`);
      }
      assert.strictEqual(timeOfDay(9), "morning");
      assert.strictEqual(timeOfDay(14), "afternoon");
      assert.strictEqual(timeOfDay(20), "evening");
      assert.strictEqual(timeOfDay(23), "late");
      assert.strictEqual(timeOfDay(2), "late");
    });
  });

  describe("greeting", () => {
    it("says hi to the night owl after the late-night hour, never good night", () => {
      for (const time of [at(23, 30), at(0, 15), at(2), at(4, 59)]) {
        for (const line of everyPick((random) => greeting(pack, time, random))) {
          assert.match(line, /^Hi, night owl/, `At ${time.getHours()}:${time.getMinutes()}, "${line}" isn't a night-owl greeting.`);
        }
      }
    });

    it("never says good night at any hour", () => {
      for (let hour = 0; hour < 24; hour++) {
        for (const line of everyPick((random) => greeting(withName, at(hour), random))) {
          assert.doesNotMatch(line, /good night/i, `At ${hour}:00, Mochi said "${line}".`);
        }
      }
    });

    it("uses the time of day before the late-night hour", () => {
      assert.ok(everyPick((random) => greeting(pack, at(9), random)).some((line) => /morning/.test(line)));
      assert.ok(everyPick((random) => greeting(pack, at(20), random)).some((line) => /evening/.test(line)));
    });
  });

  describe("her name", () => {
    it("is filled in once, as plain text, even if it looks like a placeholder", () => {
      const evening = new Date(2026, 9, 5, 19, 0);
      for (const name of ["{name}", "{thing}", "{timeOfDay}", "{companion}"]) {
        const named = layerOver(pack, { format: 1, user: { name }, phrases: { greeting: ["Good {timeOfDay}, {name}!", "Hi!"] } });
        assert.strictEqual(greeting(named, evening, () => 0), `Good evening, ${name}!`);
      }
    });

    it("is never used, or left as {name}, when no name is set", () => {
      for (const time of [at(9), at(23, 30)]) {
        for (const line of everyPick((random) => greeting(pack, time, random))) {
          assert.doesNotMatch(line, /\{name\}|undefined/, `"${line}" should not need a name.`);
        }
      }
    });

    it("is used when she has set one", () => {
      const lines = [...everyPick((r) => greeting(withName, at(9), r)), ...everyPick((r) => greeting(withName, at(23, 30), r))];
      assert.ok(lines.some((line) => line.includes("Sam")), "With a name set, some greetings should use it.");
      assert.ok(lines.every((line) => !line.includes("{name}")));
    });
  });

  it("fills {thing} when celebrating", () => {
    for (const line of everyPick((random) => pickPhrase(pack, "celebrate", { thing: "the database migration" }, random))) {
      // "Meow! The database migration is done." starts with a capital.
      assert.match(line, /the database migration/i);
    }
  });
});
