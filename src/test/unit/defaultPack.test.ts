import * as assert from "node:assert";
import { MOMENTS, fill } from "../../packs/format";
import { loadDefaultPack } from "../../packs/defaultPack";

describe("default pack", () => {
  it("loads and passes the pack format check", () => {
    assert.doesNotThrow(() => loadDefaultPack());
  });

  it("is called Mochi and has lines for every moment", () => {
    const pack = loadDefaultPack();
    assert.strictEqual(pack.name, "Mochi");
    for (const moment of MOMENTS) {
      assert.ok(pack.phrases[moment].length > 0, `The default pack needs lines for ${moment}.`);
    }
  });

  it("leaves no placeholder unfilled once Mochi speaks", () => {
    const values = { companion: "Mochi", name: "Sam", timeOfDay: "evening", thing: "the database migration", project: "homework-3" };
    for (const moment of MOMENTS) {
      for (const phrase of loadDefaultPack().phrases[moment]) {
        assert.doesNotMatch(fill(phrase, values), /[{}]/, `"${phrase}" still has a placeholder.`);
      }
    }
  });

  it("never counts how long she was away (see DESIGN.md)", () => {
    const counting = /\{days\}|\b\d+\s+(days?|weeks?|months?)\b|it's been|since you last/i;
    for (const moment of MOMENTS) {
      for (const phrase of loadDefaultPack().phrases[moment]) {
        assert.doesNotMatch(phrase, counting, `"${phrase}" counts her time away.`);
      }
    }
  });

  it("never sounds corporate, guilty, or lecturing (see MOMENTS.md)", () => {
    const offVoice = /successfully|you haven't|as i explained|you should have|failed to/i;
    for (const moment of MOMENTS) {
      for (const phrase of loadDefaultPack().phrases[moment]) {
        assert.doesNotMatch(phrase, offVoice, `"${phrase}" doesn't sound like Mochi.`);
      }
    }
  });
});
