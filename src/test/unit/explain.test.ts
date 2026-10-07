import * as assert from "node:assert";
import { errorRequest, firstStep, linesAround, nextSteps, selectionRequest, stepMessage } from "../../ai/explain";
import { question } from "../../ai/shareGate";

const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
const error = { message: "NameError: name 'y' is not defined", file: "homework.py", lines, line: 12 };

describe("explaining", () => {
  describe("what's shared", () => {
    it("shares only the error line and 3 lines on each side, numbered", () => {
      const { from, to, text } = linesAround(lines, 12);
      assert.deepStrictEqual([from, to], [9, 15]);
      assert.strictEqual(text.split("\n").length, 7);
      assert.match(text, /^ 9\| line 9\n10\| line 10/);
    });

    it("stays inside the file near its start and end", () => {
      assert.deepStrictEqual([linesAround(lines, 1).from, linesAround(lines, 1).to], [1, 4]);
      assert.deepStrictEqual([linesAround(lines, 20).from, linesAround(lines, 20).to], [17, 20]);
    });

    it("asks to share exactly those lines, naming the error line", () => {
      const request = errorRequest("explain", error);
      assert.strictEqual(
        question(request.attachments, "Copilot"),
        "Share lines 9 to 15 of homework.py (the error on line 12) with Copilot?"
      );
      assert.match(request.attachments[0].text, /^Error: NameError/);
      assert.doesNotMatch(request.attachments[0].text, /line 8\b|line 16\b/, "Nothing beyond the 7 lines.");
    });

    it("keeps the error message out of the plain message, so Send without it leaves it behind", () => {
      assert.doesNotMatch(errorRequest("explain", error).message, /NameError/);
    });
  });

  describe("the learning ladder", () => {
    it("explains by default, without the fix", () => {
      assert.match(errorRequest("explain", error).message, /what it means, why it happens, and where to look\. Don't give the fix\./);
    });

    it("gives a hint, or the smallest fix plus why, only for those steps", () => {
      assert.match(errorRequest("hint", error).message, /hint.*not the fix/);
      assert.match(errorRequest("fix", error).message, /smallest change.*why it works/);
    });

    it("offers a hint or the fix after explaining, the fix after a hint, and nothing after the fix", () => {
      assert.deepStrictEqual(nextSteps("explain")?.choices.map((c) => c.step), ["hint", "fix"]);
      assert.deepStrictEqual(nextSteps("hint")?.choices.map((c) => c.step), ["fix"]);
      assert.strictEqual(nextSteps("fix"), undefined);
    });
  });

  it("explains selected code in plain words", () => {
    const request = selectionRequest("homework.py", "print(x)");
    assert.match(request.message, /what it does and how it works/);
    assert.strictEqual(question(request.attachments, "Copilot"), "Share the selected code from homework.py with Copilot?");
  });

  describe("with Learning mode off", () => {
    it("starts with a short explanation and the fix, with nothing to climb after", () => {
      assert.strictEqual(firstStep(false), "direct");
      assert.strictEqual(firstStep(true), "explain");
      assert.match(stepMessage("direct"), /show the fix/);
      assert.strictEqual(nextSteps("direct"), undefined);
    });
  });
});
