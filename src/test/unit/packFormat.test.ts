import * as assert from "node:assert";
import { LIMITS, Pack, checkLayer, checkPack, fill, layerOver } from "../../packs/format";

const complete: Pack = {
  format: 1,
  name: "Mochi",
  voice: { personality: "Warm and playful." },
  phrases: {
    greeting: ["Good {timeOfDay}! What are we making?"],
    greetingLate: ["Hi, night owl!"],
    stuck: ["Want me to take a look?"],
    lateNight: ["It's late. Some water?"],
    lateNightCompany: ["Still here with you."],
    celebrate: ["Yay, you finished {thing}!"],
  },
};

function errorsFor(input: unknown): string {
  const result = checkLayer(input);
  assert.ok(!result.ok, "This input should have been rejected.");
  return result.errors.join("\n");
}

describe("pack format", () => {
  it("accepts a complete pack", () => {
    const result = checkPack(complete);
    assert.ok(result.ok, result.ok ? "" : result.errors.join("\n"));
  });

  it("accepts a layer that sets only a few things", () => {
    assert.ok(checkLayer({ format: 1, name: "Momo" }).ok);
    assert.ok(checkLayer({ format: 1, phrases: { stuck: ["Need a paw?"] } }).ok);
  });

  it("says what a complete pack is missing", () => {
    const result = checkPack({ format: 1, name: "Mochi" });
    assert.ok(!result.ok);
    assert.match(result.errors.join("\n"), /voice\.personality/);
    assert.match(result.errors.join("\n"), /phrases\.celebrate/);
  });

  describe("rejects untrusted input", () => {
    it("that isn't an object", () => {
      for (const input of [null, "pack", 42, [], undefined]) {
        assert.ok(!checkLayer(input).ok, `${JSON.stringify(input)} should be rejected.`);
      }
    });

    it("with the wrong format version", () => {
      assert.match(errorsFor({ format: 2 }), /"format" must be 1/);
    });

    it("with unknown fields, anywhere", () => {
      assert.match(errorsFor({ format: 1, settings: { theme: "x" } }), /unknown field "settings"/);
      assert.match(errorsFor({ format: 1, voice: { personality: "Hi", apiKey: "x" } }), /unknown field "apiKey"/);
      assert.match(errorsFor({ format: 1, phrases: { midnight: ["Hi"] } }), /unknown field "midnight"/);
    });

    it("with text that is too long", () => {
      assert.match(errorsFor({ format: 1, name: "M".repeat(LIMITS.name + 1) }), /more than the 30 allowed/);
      assert.match(errorsFor({ format: 1, phrases: { stuck: ["a".repeat(LIMITS.phrase + 1)] } }), /more than the 200/);
      assert.match(
        errorsFor({ format: 1, voice: { personality: "a".repeat(LIMITS.personality + 1) } }),
        /more than the 2000/
      );
    });

    it("with too many phrases", () => {
      const many = Array.from({ length: LIMITS.phrasesPerMoment + 1 }, (_, i) => `Line ${i}`);
      assert.match(errorsFor({ format: 1, phrases: { stuck: many } }), /21 phrases, more than the 20/);
    });

    it("with empty or non-text values", () => {
      assert.match(errorsFor({ format: 1, name: "   " }), /"name" must be some text/);
      assert.match(errorsFor({ format: 1, phrases: { stuck: [] } }), /at least one phrase/);
      assert.match(errorsFor({ format: 1, phrases: { stuck: [42] } }), /must be some text/);
    });

    it("with a name on several lines, or hidden control characters", () => {
      assert.match(errorsFor({ format: 1, name: "Mo\nchi" }), /one line/);
      assert.match(errorsFor({ format: 1, phrases: { stuck: ["Hi\u0007"] } }), /control characters/);
    });

    it("with placeholders a moment can't use", () => {
      assert.match(errorsFor({ format: 1, phrases: { stuck: ["{thing} again?"] } }), /\{thing\}, which stuck/);
      assert.match(errorsFor({ format: 1, phrases: { greeting: ["Hi {apiKey}"] } }), /\{apiKey\}/);
      assert.match(errorsFor({ format: 1, phrases: { stuck: ["Need help, {name}?"] } }), /\{name\}, which stuck/);
    });

    it("with a bad user name, or unknown user fields", () => {
      assert.match(errorsFor({ format: 1, user: { name: "A\nB" } }), /"user.name" must be one line/);
      assert.match(errorsFor({ format: 1, user: { name: "x".repeat(31) } }), /more than the 30/);
      assert.match(errorsFor({ format: 1, user: { email: "x@y.z" } }), /unknown field "email"/);
    });

    it("when every line of a moment needs her name", () => {
      assert.match(
        errorsFor({ format: 1, phrases: { greeting: ["Hi, {name}!"] } }),
        /at least one phrase without \{name\}/
      );
    });
  });

  it("accepts greetings that use her name, next to ones that don't", () => {
    assert.ok(checkLayer({ format: 1, user: { name: "Sam" }, phrases: { greeting: ["Hi, {name}!", "Hi!"] } }).ok);
  });

  describe("layering", () => {
    it("lets the layer win, and falls back to the pack for the rest", () => {
      const result = layerOver(complete, { format: 1, name: "Momo", phrases: { stuck: ["Need a paw?"] } });
      assert.strictEqual(result.name, "Momo");
      assert.deepStrictEqual(result.phrases.stuck, ["Need a paw?"]);
      assert.deepStrictEqual(result.phrases.greeting, complete.phrases.greeting);
      assert.strictEqual(result.voice.personality, complete.voice.personality);
    });

    it("replaces a moment's whole list instead of mixing lines", () => {
      const result = layerOver(complete, { format: 1, phrases: { celebrate: ["Woohoo!"] } });
      assert.deepStrictEqual(result.phrases.celebrate, ["Woohoo!"]);
    });

    it("carries her name from the layer", () => {
      assert.strictEqual(layerOver(complete, { format: 1, user: { name: "Sam" } }).user?.name, "Sam");
      assert.strictEqual(layerOver(complete, { format: 1 }).user, undefined);
    });

    it("doesn't change the pack underneath", () => {
      layerOver(complete, { format: 1, name: "Momo" });
      assert.strictEqual(complete.name, "Mochi");
    });
  });

  describe("filling placeholders", () => {
    it("fills known values and leaves the rest untouched", () => {
      assert.strictEqual(fill("Good {timeOfDay}, I'm {companion}!", { timeOfDay: "evening", companion: "Mochi" }),
        "Good evening, I'm Mochi!");
      assert.strictEqual(fill("Yay, {thing}!", {}), "Yay, {thing}!");
    });
  });
});
