import * as assert from "node:assert";
import { spokenMessage } from "../../panel/spoken";

describe("what screen readers hear when an answer is done", () => {
  it("says the cat's name, then the answer as plain text", () => {
    assert.strictEqual(
      spokenMessage("Mochi", { text: "Meow, good one! A **list** is a row of *cozy* boxes, like `snacks`." }),
      "Mochi: Meow, good one! A list is a row of cozy boxes, like snacks."
    );
  });

  it("names code blocks instead of reading the code", () => {
    const text = "Try this:\n\n```python\nsnacks = [\"tuna\"]\nsnacks.append(\"milk\")\n```\n\nAnd this:\n\n```\nprint(snacks)\n```";
    assert.strictEqual(spokenMessage("Mochi", { text }), "Mochi: Try this:\nCode block, 2 lines\nAnd this:\nCode block, 1 line");
  });

  it("reads lists item by item, and says where links go", () => {
    assert.strictEqual(
      spokenMessage("Mochi", { text: "- Lists can change\n- See the [Python tutorial](https://docs.python.org/3/tutorial/)" }),
      "Mochi: Lists can change\nSee the Python tutorial (docs.python.org)"
    );
  });

  it("ends a stopped answer with Stopped, even one that hadn't said anything", () => {
    assert.strictEqual(spokenMessage("Mochi", { text: "A list is", stopped: true }), "Mochi: A list is\nStopped.");
    assert.strictEqual(spokenMessage("Mochi", { text: "", stopped: true }), "Mochi: Stopped.");
  });

  it("uses the pack's name for the cat", () => {
    assert.match(spokenMessage("Biscuit", { text: "Hi!" }), /^Biscuit: Hi!$/);
  });

  it("never reads HTML as anything but text", () => {
    assert.strictEqual(spokenMessage("Mochi", { text: "<script>alert(1)</script>" }), "Mochi: <script>alert(1)</script>");
  });
});
