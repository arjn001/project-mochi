import * as assert from "node:assert";
import { NOT_NOW, UNDO, defineAction, offer } from "../../actions/confirm";

// A fake "her" who answers each message in turn and remembers what she saw.
function her(...answers: (string | undefined)[]) {
  const seen: { message: string; buttons: string[] }[] = [];
  return {
    seen,
    choose: async (message: string, buttons: string[]) => {
      seen.push({ message, buttons });
      return answers.shift();
    },
  };
}

// A pretend action that records whether it ran and whether it was undone.
function dimAction(options: { skip?: string; undoable?: boolean } = {}) {
  const log: string[] = [];
  const action = defineAction({
    question: "Want me to switch to a dark theme?",
    yes: "Switch to a dark theme",
    done: "Done! Changed your mind?",
    skip: () => options.skip,
    act: async () => {
      log.push("acted");
      return options.undoable === false ? undefined : async () => void log.push("undone");
    },
  });
  return { action, log };
}

describe("confirm before acting", () => {
  it("asks first, with a yes and a Not now", async () => {
    const { action } = dimAction();
    const she = her(NOT_NOW);
    await offer(action, she.choose);
    assert.deepStrictEqual(she.seen[0], {
      message: "Want me to switch to a dark theme?",
      buttons: ["Switch to a dark theme", NOT_NOW],
    });
  });

  it("acts only after she says yes", async () => {
    const { action, log } = dimAction();
    assert.strictEqual(await offer(action, her("Switch to a dark theme", undefined).choose), "done");
    assert.deepStrictEqual(log, ["acted"]);
  });

  it("does nothing when she says Not now, or just closes it", async () => {
    for (const answer of [NOT_NOW, undefined]) {
      const { action, log } = dimAction();
      assert.strictEqual(await offer(action, her(answer).choose), "declined");
      assert.deepStrictEqual(log, [], `Answering ${JSON.stringify(answer)} must not act.`);
    }
  });

  it("offers Undo afterwards, and puts things back when she picks it", async () => {
    const { action, log } = dimAction();
    const she = her("Switch to a dark theme", UNDO);
    assert.strictEqual(await offer(action, she.choose), "undone");
    assert.deepStrictEqual(she.seen[1], { message: "Done! Changed your mind?", buttons: [UNDO] });
    assert.deepStrictEqual(log, ["acted", "undone"]);
  });

  it("doesn't offer Undo for things that can't be undone", async () => {
    const { action } = dimAction({ undoable: false });
    const she = her("Switch to a dark theme");
    assert.strictEqual(await offer(action, she.choose), "done");
    assert.strictEqual(she.seen.length, 1, "Only the question should have been shown.");
  });

  it("says why instead of asking when there's nothing to do", async () => {
    const { action, log } = dimAction({ skip: "You're already on a dark theme. Cozy!" });
    const she = her(undefined);
    assert.strictEqual(await offer(action, she.choose), "skipped");
    assert.deepStrictEqual(she.seen, [{ message: "You're already on a dark theme. Cozy!", buttons: [] }]);
    assert.deepStrictEqual(log, []);
  });
});
