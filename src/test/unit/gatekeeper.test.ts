import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  DEFAULT_SPEAK_UP,
  Place,
  SPEAK_UP_LEVELS,
  SpeakUp,
  maySpeak,
  toSpeakUp,
} from "../../moments/gatekeeper";

// The rules from PRESENCE.md: may Mochi speak up here, at this level?
const rules: Record<SpeakUp, Record<Place, boolean>> = {
  quiet: { status: true, panel: false, hint: false, nudge: false },
  gentle: { status: true, panel: true, hint: true, nudge: true },
  chatty: { status: true, panel: true, hint: true, nudge: true },
};

describe("gatekeeper", () => {
  for (const level of SPEAK_UP_LEVELS) {
    for (const [place, allowed] of Object.entries(rules[level]) as [Place, boolean][]) {
      it(`${allowed ? "lets" : "stops"} Mochi in the ${place} when ${level}`, () => {
        assert.strictEqual(
          maySpeak({ place }, level),
          allowed,
          `In ${level} mode, Mochi ${allowed ? "should" : "must not"} speak up in the ${place}.`
        );
      });
    }
  }

  it("allows fun facts and small talk only when chatty", () => {
    for (const level of SPEAK_UP_LEVELS) {
      assert.strictEqual(
        maySpeak({ place: "panel", extra: true }, level),
        level === "chatty",
        `Extras like fun facts ${level === "chatty" ? "should" : "must not"} appear in ${level} mode.`
      );
    }
  });

  it("treats unknown values as gentle, the default", () => {
    for (const value of ["loud", "", "   ", "silent", 42, null, undefined, {}]) {
      assert.strictEqual(
        toSpeakUp(value),
        "gentle",
        `${JSON.stringify(value)} isn't a speak-up level, so Mochi should behave as gentle.`
      );
      assert.strictEqual(maySpeak({ place: "hint" }, value), true);
      assert.strictEqual(maySpeak({ place: "panel", extra: true }, value), false);
    }
  });

  it("accepts levels typed by hand with different capitals or spaces", () => {
    assert.strictEqual(toSpeakUp("Quiet"), "quiet");
    assert.strictEqual(toSpeakUp(" CHATTY "), "chatty");
  });
});

describe("speak-up setting in package.json", () => {
  const root = path.resolve(__dirname, "../../..");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const setting = pkg.contributes.configuration.properties["mochi.speakUp"];

  it("offers exactly the levels the gatekeeper knows, with the same default", () => {
    assert.deepStrictEqual(
      setting.enum,
      [...SPEAK_UP_LEVELS],
      "The levels in package.json and gatekeeper.ts have drifted apart."
    );
    assert.strictEqual(
      setting.default,
      DEFAULT_SPEAK_UP,
      "The default in package.json and gatekeeper.ts have drifted apart."
    );
  });
});
