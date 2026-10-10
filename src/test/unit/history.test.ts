import * as assert from "node:assert";
import { HISTORY_CHARS, historyBudget, recentTurns } from "../../ai/history";

const pair = (asked: string, answer: string) => [
  { from: "her" as const, text: asked },
  { from: "mochi" as const, text: answer },
];

describe("the recent messages sent along", () => {
  it("sends her messages and the answers to them, in order", () => {
    const chat = [...pair("what's a list?", "A row of boxes."), ...pair("and a tuple?", "A row that can't change.")];
    assert.deepStrictEqual(recentTurns(chat, HISTORY_CHARS), chat);
  });

  it("picks the newest first, and stops when the budget is used", () => {
    const chat = [...pair("old", "x".repeat(50)), ...pair("middle", "y".repeat(50)), ...pair("new", "z".repeat(50))];
    const turns = recentTurns(chat, 120);
    assert.deepStrictEqual(
      turns.map((t) => t.text.slice(0, 6)),
      ["middle", "yyyyyy", "new", "zzzzzz"]
    );
  });

  it("never cuts a message in half", () => {
    assert.deepStrictEqual(recentTurns(pair("hi", "a".repeat(500)), 100), []);
  });

  it("leaves out kind lines about problems, lines on their own, and messages with no answer", () => {
    const chat = [
      { from: "mochi" as const, text: "I'll think once you pick a brain." },
      { from: "her" as const, text: "hi" },
      { from: "mochi" as const, text: "I'd need a brain to answer that.", problem: true },
      { from: "her" as const, text: "hello?" },
      ...pair("what's a list?", "A row of boxes."),
      { from: "her" as const, text: "still streaming" },
      { from: "mochi" as const, text: "" },
    ];
    assert.deepStrictEqual(recentTurns(chat, HISTORY_CHARS), pair("what's a list?", "A row of boxes."));
  });

  it("says what was shared, but never sends the code again", () => {
    const chat = [
      { from: "her" as const, text: "Explain this", shared: "shared lines 9 to 15 of homework.py" },
      { from: "mochi" as const, text: "It adds two numbers." },
    ];
    assert.deepStrictEqual(recentTurns(chat, HISTORY_CHARS)[0], {
      from: "her",
      text: "Explain this\n\n[shared lines 9 to 15 of homework.py, not included again]",
    });
  });

  it("sends less to a brain that can't take much", () => {
    assert.strictEqual(historyBudget(), HISTORY_CHARS);
    assert.strictEqual(historyBudget(128_000), HISTORY_CHARS);
    assert.strictEqual(historyBudget(8_000), 8_000);
    assert.strictEqual(historyBudget(0), HISTORY_CHARS);
  });
});
