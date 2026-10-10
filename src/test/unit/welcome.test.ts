import * as assert from "node:assert";
import { wasWelcomed, welcomeDue, welcomeText } from "../../moments/welcome";

const start = "Meow, hi! I'm Mochi, your coding buddy. I live in the Mochi tab, and my mood shows in the status bar.";

describe("the first-run welcome", () => {
  describe("what Mochi says", () => {
    it("names the brain it would think with", () => {
      assert.deepStrictEqual(welcomeText("Mochi", { kind: "ready", label: "Copilot · Auto" }), {
        text: `${start} I can think with Copilot · Auto whenever you ask me something.`,
      });
    });

    it("offers Copilot's setup when there's no brain", () => {
      assert.deepStrictEqual(welcomeText("Mochi", { kind: "none", copilotSetup: true }), {
        text: `${start} To answer questions I need a brain, and GitHub Copilot's free plan works: just sign in with GitHub.`,
        button: "setUpCopilot",
      });
    });

    it("offers Choose a brain in editors without Copilot's setup", () => {
      assert.deepStrictEqual(welcomeText("Mochi", { kind: "none", copilotSetup: false }), {
        text: `${start} To answer questions I need a brain. Choose a brain shows what you can use.`,
        button: "chooseBrain",
      });
    });

    it("says nothing about a brain when there are some but none is chosen yet", () => {
      assert.deepStrictEqual(welcomeText("Mochi", { kind: "ask" }), { text: start });
    });

    it("uses the pack's name for the cat, and the tab's own label", () => {
      const { text } = welcomeText("Luna", { kind: "ask" });
      assert.strictEqual(text, "Meow, hi! I'm Luna, your coding buddy. I live in the Mochi tab, and my mood shows in the status bar.");
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
