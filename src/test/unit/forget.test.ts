import * as assert from "node:assert";
import { Forgettable, forgetEverything } from "../../forget";

// Parts that record when they're forgotten; `broken` ones fail.
function parts(...names: string[]) {
  const forgotten: string[] = [];
  const list: Forgettable[] = names.map((name) => ({
    forget: async () => {
      if (name.startsWith("broken")) {
        throw new Error("storage is busy");
      }
      forgotten.push(name);
    },
  }));
  return { forgotten, list };
}

describe("forget everything", () => {
  it("asks first, saying what's cleared and what stays", async () => {
    const asked: string[] = [];
    await forgetEverything(async (question, detail) => (asked.push(question, detail), false), []);
    assert.strictEqual(asked[0], "Forget everything?");
    assert.match(asked[1], /your chats, your name and personal touches, and everything Mochi remembers about your days/);
    assert.match(asked[1], /Your settings and any saved AI key stay as they are/);
  });

  it("forgets nothing unless she says yes", async () => {
    const { forgotten, list } = parts("chat", "personal layer");
    assert.strictEqual(await forgetEverything(async () => false, list), "kept");
    assert.deepStrictEqual(forgotten, []);
  });

  it("forgets every part after a yes", async () => {
    const { forgotten, list } = parts("chat", "personal layer", "greeting memory");
    assert.strictEqual(await forgetEverything(async () => true, list), "forgotten");
    assert.deepStrictEqual(forgotten, ["chat", "personal layer", "greeting memory"]);
  });

  it("keeps going if one part fails, and says so", async () => {
    const { forgotten, list } = parts("chat", "broken", "greeting memory");
    assert.strictEqual(await forgetEverything(async () => true, list), "partly");
    assert.deepStrictEqual(forgotten, ["chat", "greeting memory"]);
  });
});
