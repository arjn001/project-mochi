import * as assert from "node:assert";
import { wasWelcomed, welcomeDue, welcomeText } from "../../moments/welcome";
import { welcomeStrings } from "../../strings";

// The welcome is built from these parts; the words themselves live in
// strings.ts (MOCHI-70: test which parts appear, not the wording).
const start = `${welcomeStrings.hello("Mochi")} ${welcomeStrings.where}`;

describe("the first-run welcome", () => {
  describe("what Mochi says", () => {
    it("names the brain it would think with", () => {
      assert.deepStrictEqual(welcomeText("Mochi", { kind: "ready", label: "Copilot · Auto" }), {
        text: `${start} ${welcomeStrings.ready("Copilot · Auto")}`,
      });
    });

    it("offers Copilot's setup when there's no brain", () => {
      assert.deepStrictEqual(welcomeText("Mochi", { kind: "none", copilotSetup: true }), {
        text: `${start} ${welcomeStrings.copilot}`,
        button: "setUpCopilot",
      });
    });

    it("offers Choose a brain in editors without Copilot's setup", () => {
      assert.deepStrictEqual(welcomeText("Mochi", { kind: "none", copilotSetup: false }), {
        text: `${start} ${welcomeStrings.choose}`,
        button: "chooseBrain",
      });
    });

    it("says nothing about a brain when there are some but none is chosen yet", () => {
      assert.deepStrictEqual(welcomeText("Mochi", { kind: "ask" }), { text: start });
    });

    it("uses the pack's name for the cat, and the tab's own label", () => {
      const { text } = welcomeText("Luna", { kind: "ask" });
      assert.match(text, /\bLuna\b/);
      assert.match(text, /the Mochi tab/, "The tab's own label, which packs can't change.");
    });

    it("never uses an em dash", () => {
      for (const brain of [{ kind: "ask" as const }, { kind: "none" as const, copilotSetup: true }]) {
        assert.ok(!welcomeText("Mochi", brain).text.includes("—"));
      }
    });
  });

  describe("when", () => {
    it("welcomes someone new", () => {
      assert.strictEqual(welcomeDue(wasWelcomed(undefined, false), "gentle", false), true);
    });

    it("never welcomes someone who used Mochi before the welcome existed", () => {
      assert.strictEqual(wasWelcomed(undefined, true), true);
    });

    it("only once", () => {
      assert.strictEqual(welcomeDue(wasWelcomed(true, false), "gentle", false), false);
    });

    it("waits through quiet mode and focus sessions, then welcomes", () => {
      // Waiting is remembered as false, so later greeting memories don't count.
      assert.strictEqual(welcomeDue(false, "quiet", false), false);
      assert.strictEqual(welcomeDue(false, "gentle", true), false);
      assert.strictEqual(wasWelcomed(false, true), false);
      assert.strictEqual(welcomeDue(wasWelcomed(false, true), "chatty", false), true);
    });
  });
});
