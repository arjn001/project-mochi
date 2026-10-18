import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { Dialogs, dialogAsk } from "../../ai/shareDialog";
import { shareStrings } from "../../strings";

// Dialogs where "she" clicks the given button, and that remember what they
// showed.
function clicking(button: string | undefined) {
  const shown: { kind: string; question: string; detail?: string; buttons: string[] }[] = [];
  const dialogs: Dialogs = {
    warning: async (question, buttons) => (shown.push({ kind: "warning", question, buttons }), button),
    information: async (question, detail, buttons) => (shown.push({ kind: "information", question, detail, buttons }), button),
  };
  return { ask: dialogAsk(dialogs), shown };
}

describe("the share gate's dialog", () => {
  describe("about what Mochi would attach", () => {
    it("shares only after Share", async () => {
      assert.strictEqual(await clicking(shareStrings.share).ask("Share lines 9 to 15 of homework.py with Copilot?"), "share");
    });

    it("sends only her message after Send without it", async () => {
      assert.strictEqual(await clicking(shareStrings.sendWithout).ask("Share it?"), "sendWithout");
    });

    it("sends nothing when she closes it or presses Escape", async () => {
      assert.strictEqual(await clicking(undefined).ask("Share it?"), "cancel");
    });

    it("sends nothing for anything she didn't clearly pick", async () => {
      for (const odd of ["share", "Cancel", "Send anyway", "", " Share"]) {
        assert.strictEqual(await clicking(odd).ask("Share it?"), "cancel", JSON.stringify(odd));
      }
    });

    it("shows her the question, says nothing leaves without Share, and offers only those two", async () => {
      const { ask, shown } = clicking(undefined);
      await ask("Share lines 9 to 15 of homework.py with Copilot?");
      assert.deepStrictEqual(shown, [
        {
          kind: "information",
          question: "Share lines 9 to 15 of homework.py with Copilot?",
          detail: shareStrings.detail,
          buttons: [shareStrings.share, shareStrings.sendWithout],
        },
      ]);
    });
  });

  describe("about what she typed that looks like a secret", () => {
    it("sends only after Send anyway", async () => {
      assert.strictEqual(await clicking(shareStrings.sendAnyway).ask("Careful... Send anyway?", "typedSecret"), "share");
    });

    it("sends nothing when she closes it, or for any other button", async () => {
      for (const odd of [undefined, shareStrings.share, shareStrings.sendWithout, "send anyway"]) {
        assert.strictEqual(await clicking(odd).ask("Careful... Send anyway?", "typedSecret"), "cancel", String(odd));
      }
    });

    it("is a warning with Send anyway as its only button, never Send without it", async () => {
      const { ask, shown } = clicking(undefined);
      await ask("Careful... Send anyway?", "typedSecret");
      assert.deepStrictEqual(shown, [{ kind: "warning", question: "Careful... Send anyway?", buttons: [shareStrings.sendAnyway] }]);
    });
  });

  it("uses modal dialogs in VS Code, so nothing happens while she decides", () => {
    const glue = fs.readFileSync(path.join(__dirname, "..", "..", "..", "src", "ai", "askToShare.ts"), "utf8");
    const calls = glue.match(/show(Warning|Information)Message\([^)]*\)/g) ?? [];
    assert.strictEqual(calls.length, 2);
    for (const call of calls) {
      assert.match(call, /\{ modal: true/, call);
    }
  });
});
