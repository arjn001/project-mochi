import * as assert from "node:assert";
import { ChatChange, ChatLog } from "../../panel/chatLog";

function chat() {
  const changes: ChatChange[] = [];
  let revealed = 0;
  const log = new ChatLog(
    (change) => changes.push(change),
    () => revealed++
  );
  return { log, changes, revealed: () => revealed };
}

const shape = (log: ChatLog) => log.entries().map((e) => [e.from, e.text, e.chips?.choices.map((c) => c.label) ?? null]);

describe("the chat", () => {
  it("shows what she asked, then Mochi's answer as it streams", () => {
    const { log, changes } = chat();
    log.start("what's a list?");
    log.append("A list is ");
    log.append("a row of boxes.");
    log.finish();
    assert.deepStrictEqual(shape(log), [
      ["her", "what's a list?", null],
      ["mochi", "A list is a row of boxes.", null],
    ]);
    // Streamed pieces only redraw that one message.
    assert.deepStrictEqual(changes.slice(-2), [
      { type: "append", id: 2, text: "A list is " },
      { type: "append", id: 2, text: "a row of boxes." },
    ]);
  });

  it("shows the chat when a new message starts, like Explain from the editor", () => {
    const { log, revealed } = chat();
    log.start("Explain the error on line 12 of homework.py");
    assert.ok(revealed() > 0);
  });

  it("offers next steps as chips, and her pick comes back", async () => {
    const { log } = chat();
    log.start("Explain the error on line 12 of homework.py");
    log.append("It means y was never set.");
    log.finish();
    const pick = log.offerNext("Want a hint, or the fix?", ["Give me a hint", "Show the fix"]);
    const entry = log.entries()[1];
    assert.deepStrictEqual(entry.chips, {
      prompt: "Want a hint, or the fix?",
      choices: [
        { id: "0", label: "Give me a hint" },
        { id: "1", label: "Show the fix" },
      ],
    });
    log.choose(entry.id, "0");
    assert.strictEqual(await pick, "Give me a hint");
    assert.strictEqual(entry.chips, undefined, "Chips go away once she picks.");
  });

  it("drops chips she didn't pick when she moves on, as a closed notification would", async () => {
    const { log } = chat();
    log.start("Explain this");
    log.append("Sure.");
    log.finish();
    const pick = log.offerNext("Want a hint?", ["Give me a hint"]);
    log.start("something else");
    assert.strictEqual(await pick, undefined);
    assert.ok(log.entries().every((e) => !e.chips));
  });

  it("ignores old or unknown chips", async () => {
    const { log } = chat();
    log.start("Explain this");
    log.append("Sure.");
    const pick = log.offerNext("Want a hint?", ["Give me a hint"]);
    log.choose(99, "0");
    log.choose(log.entries()[1].id, "7");
    log.say("A line.");
    assert.strictEqual(await pick, undefined, "Only her real pick counts.");
  });

  it("shows a problem as a kind line, with a chip when she can do something", async () => {
    const { log } = chat();
    const clicked = log.problem("I'd need a brain to answer that. Want to set one up?", "Set one up");
    const entry = log.entries()[0];
    assert.strictEqual(entry.problem, true);
    assert.deepStrictEqual(entry.chips?.choices.map((c) => c.label), ["Set one up"]);
    log.choose(entry.id, "0");
    assert.strictEqual(await clicked, true);
  });

  it("keeps going in the same answer", () => {
    const { log } = chat();
    log.start("explain everything");
    log.append("A long first part");
    log.finish();
    void log.problem("That got long, so I stopped here. Want me to keep going?", "Keep going");
    log.resume();
    log.append(" and the rest.");
    log.finish();
    assert.deepStrictEqual(
      log.entries().map((e) => e.text),
      ["explain everything", "A long first part and the rest.", "That got long, so I stopped here. Want me to keep going?"]
    );
  });

  it("says a short line without her side, like when no brain is picked", () => {
    const { log } = chat();
    log.say("I'll think once you pick a brain. Mochi: Choose a brain whenever you're ready.");
    assert.deepStrictEqual(shape(log), [["mochi", "I'll think once you pick a brain. Mochi: Choose a brain whenever you're ready.", null]]);
  });

  it("clears without showing the panel", async () => {
    const { log, revealed } = chat();
    log.start("hi");
    const pick = log.offerNext("Want a hint?", ["Give me a hint"]);
    const before = revealed();
    log.clear();
    assert.deepStrictEqual(log.entries(), []);
    assert.strictEqual(revealed(), before);
    assert.strictEqual(await pick, undefined);
  });

  it("brings a saved chat back before anything asked while it loaded, without showing the panel", () => {
    const { log, revealed } = chat();
    log.start("hi again");
    log.append("Hello!");
    log.finish();
    const before = revealed();
    log.restore([
      { from: "her", text: "what's a list?", shared: "lines 9 to 15 of homework.py" },
      { from: "mochi", text: "A row of boxes." },
    ]);
    assert.deepStrictEqual(
      log.entries().map((e) => e.text),
      ["what's a list?", "A row of boxes.", "hi again", "Hello!"]
    );
    assert.strictEqual(new Set(log.entries().map((e) => e.id)).size, 4, "Every message has its own id.");
    assert.strictEqual(revealed(), before);
  });

  it("saves messages without chips, and skips an answer with nothing in it yet", () => {
    const { log } = chat();
    void log.problem("I'd need a brain to answer that. Want to set one up?", "Set one up");
    log.start("what's a list?");
    assert.deepStrictEqual(log.saved(), [
      { from: "mochi", text: "I'd need a brain to answer that. Want to set one up?", problem: true },
      { from: "her", text: "what's a list?" },
    ]);
  });
});
