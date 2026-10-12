import * as assert from "node:assert";
import { celebrationLine, checkMessage, finishedSomething } from "../../moments/finished";
import { loadDefaultPack } from "../../packs/defaultPack";
import * as path from "node:path";

const thing = (message: string) => finishedSomething(message)?.thing;

describe("noticing when she finished something", () => {
  it("names what she finished, in her words", () => {
    assert.strictEqual(thing("I finished the for loop!"), "the for loop");
    assert.strictEqual(thing("done with question 3"), "question 3");
    assert.strictEqual(thing("I'm done with question 3."), "question 3");
    assert.strictEqual(thing("I've finally completed the database migration"), "the database migration");
    assert.strictEqual(thing("question 3 is done!"), "question 3");
    assert.strictEqual(thing("finished part D"), "part D");
    assert.strictEqual(thing("Yay! I did the bubble sort :)"), "the bubble sort");
    assert.strictEqual(thing("I’m done with lab 2"), "lab 2");
  });

  it("says it back to her: my becomes your", () => {
    assert.strictEqual(thing("I finished my homework"), "your homework");
    assert.strictEqual(thing("our group project is done"), "your group project");
  });

  it("celebrates without naming anything when there's nothing to name", () => {
    assert.deepStrictEqual(finishedSomething("It finally works!"), {});
    assert.deepStrictEqual(finishedSomething("my code works now"), {});
    assert.deepStrictEqual(finishedSomething("yay, done!"), {});
    assert.deepStrictEqual(finishedSomething("finally finished :)"), {});
  });

  it("never treats a bare \"I'm done\" or \"done!\" as a win: it can mean giving up", () => {
    for (const message of ["I'm done", "I'm done!", "done!", "done.", "I finished"]) {
      assert.strictEqual(finishedSomething(message), undefined, message);
    }
  });

  it("never celebrates frustration", () => {
    for (const message of [
      "I'm done with this class",
      "done, I give up",
      "I did it wrong again",
      "finally done crying over this",
      "I quit",
      "I'm done, I hate this",
      "I'm so tired, done with question 3",
      "I can't, I'm done with it",
      "done with question 3, ugh",
      "I'm stuck, done for today",
      "finished but it's still broken",
      "I finished question 3 and it failed",
      "my code doesn't work, I'm done",
      "I finished the loop and it won't run",
      "worst assignment ever, done with it",
      "I didn't finish question 3",
    ]) {
      assert.strictEqual(finishedSomething(message), undefined, message);
    }
  });

  it("leaves vague things to the brain", () => {
    for (const message of ["I'm done with this", "I did it", "done with everything", "I'm done with coding", "finished it", "that is done"]) {
      assert.strictEqual(finishedSomething(message), undefined, message);
    }
  });

  it("leaves questions and problems to the brain", () => {
    for (const message of [
      "I finished the loop but it prints twice?",
      "I finished question 3, what's next?",
      "done with question 3, how do I start question 4",
      "I finished question 3 but there's an error",
      "I'm almost done with question 3",
      "not done with question 3 yet",
      "I finished question 3\nnow what",
    ]) {
      assert.strictEqual(finishedSomething(message), undefined, message);
    }
  });

  it("ignores everything else", () => {
    for (const message of ["what's a list?", "hi Mochi", "", "   ", "explain this code", "I like cats"]) {
      assert.strictEqual(finishedSomething(message), undefined, message);
    }
  });

  it("only repeats plain words, so nothing she typed becomes formatting or a link", () => {
    for (const message of [
      "I finished **the loop**",
      "I finished `main.py`",
      "I finished [my site](https://evil.example)",
      "I finished https://evil.example",
      "I finished <script>alert(1)</script>",
    ]) {
      assert.deepStrictEqual(finishedSomething(message), {}, message);
    }
  });

  it("doesn't repeat a very long thing", () => {
    assert.deepStrictEqual(finishedSomething(`I finished ${"the very long assignment ".repeat(3)}`), {});
    assert.strictEqual(finishedSomething(`I finished ${"x".repeat(130)}`), undefined, "Too long to be a quick celebration.");
  });

  describe("what Mochi says", () => {
    const pack = loadDefaultPack(path.join(__dirname, "..", "..", "..", "packs", "default", "pack.json"));

    it("celebrates the specific thing, from the pack", () => {
      const lines = [0, 0.4, 0.9].map((r) => celebrationLine(pack, { thing: "your homework" }, () => r));
      assert.ok(lines.every((line) => /your homework/i.test(line)), lines.join(" | "));
      assert.ok(lines.some((line) => line.startsWith("Meow! Your homework is done.")), "A sentence starts with a capital.");
    });

    it("asks the brain to check her work: hints in Learning mode, fixes without it", () => {
      assert.strictEqual(
        checkMessage(true, "your homework"),
        "I just finished my homework. Please check my work: tell me what's good about it, and point out anything that might be wrong as hints, not fixes."
      );
      assert.match(checkMessage(false), /^I just finished this\. .*show the fix/);
    });

    it("says \"Yay, you did it!\" when there's nothing to name", () => {
      assert.strictEqual(celebrationLine(pack, {}), "Yay, you did it! That earns a slow blink from me.");
    });
  });
});
