import * as assert from "node:assert";
import { BrainInfo, CLAUDE_VENDOR, brainButton, brainLabel, chooseBrain, fallbackNote, isUsable, toBrainSetting } from "../../ai/brains";

const brain = (vendor: string, id: string, name: string, maxInputTokens = 100_000): BrainInfo => ({
  vendor,
  id,
  name,
  maxInputTokens,
});

// What "List available brains" showed on Arjun's normal profile, 2026-10-07.
const todaysList: BrainInfo[] = [
  brain("copilot", "gpt-4o-mini", "GPT-4o mini", 12078),
  brain("copilot", "auto", "Auto", 935793),
  brain("copilot", "copilot-utility-small", "GPT-4o mini", 12078),
  brain("copilot", "copilot-utility", "GPT-5.3-Codex", 271790),
  brain("copilot", "copilot-dictation-cleanup-luna", "GPT-5.6 Luna", 921793),
  brain("copilot", "gpt-5.6-luna", "GPT-5.6 Luna", 921793),
  brain("copilotcli", "auto", "Auto", 0),
];

describe("choosing a brain", () => {
  describe("which brains she can chat with", () => {
    it("hides Copilot's helper models and anything that can't take a message", () => {
      assert.deepStrictEqual(
        todaysList.filter(isUsable).map(brainLabel),
        ["Copilot · GPT-4o mini", "Copilot · Auto", "Copilot · GPT-5.6 Luna"]
      );
    });

    it("keeps brains from other extensions", () => {
      assert.ok(isUsable(brain("ollama", "llama3", "Llama 3")));
      assert.strictEqual(brainLabel(brain("ollama", "llama3", "Llama 3")), "Ollama · Llama 3");
    });
  });

  describe("the mochi.brain setting", () => {
    it("reads vendor/id", () => {
      assert.deepStrictEqual(toBrainSetting("copilot/gpt-5.6-luna"), { vendor: "copilot", id: "gpt-5.6-luna" });
      assert.deepStrictEqual(toBrainSetting("  copilot/auto "), { vendor: "copilot", id: "auto" });
    });

    it("treats empty or malformed values as 'let Mochi choose'", () => {
      for (const value of ["", "   ", "auto", "copilot/", "/auto", "copi lot/auto", "copilot/a b", 42, null, undefined, {}]) {
        assert.strictEqual(toBrainSetting(value), undefined, JSON.stringify(value));
        assert.deepStrictEqual(chooseBrain(value, todaysList), { kind: "use", brain: todaysList[1] });
      }
    });
  });

  describe("the order", () => {
    it("uses Copilot's Auto when she hasn't picked", () => {
      assert.deepStrictEqual(chooseBrain("", todaysList), { kind: "use", brain: todaysList[1] });
    });

    it("uses her pick when it's there", () => {
      assert.deepStrictEqual(chooseBrain("copilot/gpt-5.6-luna", todaysList), { kind: "use", brain: todaysList[5] });
    });

    it("never picks a helper model, even if she somehow set one", () => {
      const choice = chooseBrain("copilot/copilot-utility", todaysList);
      assert.strictEqual(choice.kind === "use" && choice.brain.id, "auto");
    });

    it("stands in with Auto when her pick is gone, and says which pick", () => {
      assert.deepStrictEqual(chooseBrain("copilot/gpt-9", todaysList), {
        kind: "use",
        brain: todaysList[1],
        missing: { vendor: "copilot", id: "gpt-9" },
      });
    });

    it("treats a vendor with no brains right now as a pick that's gone", () => {
      const choice = chooseBrain("ollama/llama3", todaysList);
      assert.strictEqual(choice.kind === "use" && choice.missing?.vendor, "ollama");
    });

    it("asks her when there's no Auto and no pick, never choosing another model", () => {
      const noAuto = todaysList.filter((b) => b.id !== "auto");
      assert.deepStrictEqual(chooseBrain("", noAuto), { kind: "ask", usable: noAuto.filter(isUsable) });
      assert.strictEqual(chooseBrain("copilot/gpt-9", noAuto).kind, "ask");
    });

    it("has nothing to offer with no usable brains", () => {
      assert.deepStrictEqual(chooseBrain("", []), { kind: "none" });
      assert.deepStrictEqual(chooseBrain("", [todaysList[6]]), { kind: "none" });
    });
  });

  describe("her own Claude key", () => {
    const haiku = brain(CLAUDE_VENDOR, "claude-haiku-4-5-20251001", "Claude Haiku 4.5", 200_000);
    const sonnet = brain(CLAUDE_VENDOR, "claude-sonnet-5-5", "Claude Sonnet 5.5", 1_000_000);

    it("shows her Claude models by their own name", () => {
      assert.strictEqual(brainLabel(haiku), "Claude Haiku 4.5");
    });

    it("uses her Claude pick, saved like any other", () => {
      assert.deepStrictEqual(chooseBrain("claude-key/claude-sonnet-5-5", [...todaysList, haiku, sonnet]), { kind: "use", brain: sonnet });
    });

    it("never picks a Claude model for her: Auto stays the default", () => {
      assert.deepStrictEqual(chooseBrain("", [...todaysList, haiku, sonnet]), { kind: "use", brain: todaysList[1] });
    });

    it("asks with only her key and no pick", () => {
      assert.deepStrictEqual(chooseBrain("", [haiku, sonnet]), { kind: "ask", usable: [haiku, sonnet] });
    });

    it("stands in with Auto, or asks, when her Claude model is retired", () => {
      assert.deepStrictEqual(chooseBrain("claude-key/claude-opus-4-1", [...todaysList, haiku]), {
        kind: "use",
        brain: todaysList[1],
        missing: { vendor: CLAUDE_VENDOR, id: "claude-opus-4-1" },
      });
      assert.strictEqual(chooseBrain("claude-key/claude-opus-4-1", [haiku]).kind, "ask");
    });
  });

  describe("the quick note about a stand-in", () => {
    const standIn = { brain: todaysList[1], missing: { vendor: "copilot", id: "gpt-5.6-luna" } };

    it("is shown once per change, in her words for the brain", () => {
      const first = fallbackNote(standIn, undefined, "Copilot · GPT-5.6 Luna");
      assert.strictEqual(
        first.note,
        "Quick note: Copilot · GPT-5.6 Luna isn't available right now, so I'm thinking with Copilot · Auto instead. Mochi: Choose a brain changes this."
      );
      assert.strictEqual(fallbackNote(standIn, first.noted, "Copilot · GPT-5.6 Luna").note, undefined, "Not on every answer.");
    });

    it("can show again after her pick comes back and disappears again", () => {
      const first = fallbackNote(standIn, undefined, undefined);
      const back = fallbackNote({ brain: todaysList[5] }, first.noted, undefined);
      assert.strictEqual(back.noted, undefined);
      assert.ok(fallbackNote(standIn, back.noted, undefined).note);
    });

    it("uses the model id when Mochi doesn't know its name", () => {
      assert.match(fallbackNote(standIn, undefined, undefined).note ?? "", /^Quick note: gpt-5\.6-luna isn't/);
    });
  });
});

describe("the brain at the top of the chat", () => {
  it("names the brain, and says what a click does", () => {
    assert.deepStrictEqual(brainButton("Copilot · Auto"), {
      label: "Copilot · Auto",
      tooltip: "Choose a brain",
      spoken: "Copilot · Auto. Choose a brain",
    });
  });

  it("says Choose a brain when Mochi would ask first, or has none", () => {
    assert.deepStrictEqual(brainButton(undefined), { label: "Choose a brain", tooltip: "Choose a brain", spoken: "Choose a brain" });
  });
});
