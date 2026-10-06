import * as assert from "node:assert";
import { STUCK_AFTER_MS, StuckCheck, errorKey, onlyErrors, stuckOn, track } from "../../moments/stuck";

const file = ["x = 1", "def show():", "    print(y)", "show()"];
const message = "NameError: name 'y' is not defined";
const minutes = (n: number) => n * 60_000;

// She's been typing, gentle mode, nothing offered yet. Tests change one thing.
function check(overrides: Partial<StuckCheck> = {}): StuckCheck {
  const key = errorKey("homework.py", message, file, 2);
  return {
    now: minutes(3),
    lastEditAt: minutes(3),
    speakUp: "gentle",
    tracked: new Map([[key, 0]]),
    offered: new Set(),
    ...overrides,
  };
}

describe("noticing when she's stuck", () => {
  describe("which error is which", () => {
    it("is the same error after it moves down because she added lines above", () => {
      const before = errorKey("homework.py", message, file, 2);
      const shifted = ["# my homework", "", "x = 1", "def show():", "    print(y)", "show()"];
      assert.strictEqual(errorKey("homework.py", message, shifted, 4), before);
    });

    it("ignores changes in indentation and spacing", () => {
      const reindented = ["x = 1", "def show():", "        print(y)", "show()"];
      assert.strictEqual(errorKey("homework.py", message, reindented, 2), errorKey("homework.py", message, file, 2));
    });

    it("is a different error with a different message, code, or file", () => {
      const key = errorKey("homework.py", message, file, 2);
      assert.notStrictEqual(errorKey("homework.py", "SyntaxError: invalid syntax", file, 2), key);
      assert.notStrictEqual(errorKey("homework.py", message, ["x = 1", "def show():", "    print(z)", "show()"], 2), key);
      assert.notStrictEqual(errorKey("lab.py", message, file, 2), key);
    });
  });

  describe("offering a paw", () => {
    it("offers once an error has stayed for 2 minutes", () => {
      assert.strictEqual(stuckOn(check({ now: STUCK_AFTER_MS - 1, lastEditAt: STUCK_AFTER_MS - 1 })).length, 0);
      assert.strictEqual(stuckOn(check()).length, 1);
    });

    it("never offers the same error twice in a session, even after it moved", () => {
      const original = errorKey("homework.py", message, file, 2);
      const shifted = errorKey("homework.py", message, ["# notes", "x = 1", "def show():", "    print(y)", "show()"], 3);
      assert.strictEqual(stuckOn(check({ tracked: new Map([[shifted, 0]]), offered: new Set([original]) })).length, 0);
    });

    it("only offers while she's actively editing", () => {
      assert.strictEqual(stuckOn(check({ lastEditAt: undefined })).length, 0);
      assert.strictEqual(stuckOn(check({ now: minutes(9), lastEditAt: minutes(3) })).length, 0, "Not typed for 6 minutes.");
    });

    it("never offers in quiet mode", () => {
      assert.strictEqual(stuckOn(check({ speakUp: "quiet" })).length, 0);
    });
  });

  describe("tracking errors", () => {
    it("keeps when an error was first seen, and forgets errors that went away", () => {
      const first = track(new Map(), ["a", "b"], minutes(1));
      const later = track(first, ["a", "c"], minutes(2));
      assert.deepStrictEqual([...later], [["a", minutes(1)], ["c", minutes(2)]]);
    });

    it("counts errors only, never warnings", () => {
      const all = [
        { severity: "error" as const, message: "NameError", line: 2 },
        { severity: "warning" as const, message: "unused variable", line: 0 },
      ];
      assert.deepStrictEqual(onlyErrors(all).map((e) => e.message), ["NameError"]);
    });
  });
});
