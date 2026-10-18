import * as assert from "node:assert";
import { Mood, moodLine } from "../../presence/mood";

const moods: Mood[] = ["here", "purring", "napping"];

describe("mood line", () => {
  it("naps in quiet mode, whatever the mood would have been", () => {
    for (const mood of moods) {
      const line = moodLine("quiet", mood);
      assert.strictEqual(
        line.text,
        "$(mochi-napping) Mochi is napping",
        `In quiet mode, napping must win over "${mood}".`
      );
      assert.match(line.tooltip, /Quiet mode/);
    }
  });

  it("shows the mood itself when gentle or chatty", () => {
    for (const level of ["gentle", "chatty"]) {
      for (const mood of moods) {
        assert.ok(
          moodLine(level, mood).text.startsWith(`$(mochi-${mood}) `),
          `In ${level} mode, the "${mood}" mood should show its own icon.`
        );
        assert.strictEqual(moodLine(level, mood).tooltip, "Open Mochi");
      }
    }
  });

  it("purrs by default, and treats unknown levels as gentle", () => {
    assert.strictEqual(moodLine("gentle").text, "$(mochi-purring) Mochi is purring");
    assert.strictEqual(moodLine("loud").text, "$(mochi-purring) Mochi is purring");
    assert.strictEqual(moodLine(undefined).text, "$(mochi-purring) Mochi is purring");
  });

  it("gives screen readers words, not icon names", () => {
    for (const level of ["quiet", "gentle"]) {
      for (const mood of moods) {
        assert.ok(
          !moodLine(level, mood).label.includes("$("),
          "The accessible label must not contain icon syntax like $(mochi-purring)."
        );
      }
    }
  });
});
