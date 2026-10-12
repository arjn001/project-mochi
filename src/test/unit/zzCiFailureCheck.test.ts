import * as assert from "node:assert";

// Throwaway: proves every CI system reports a failing test (MOCHI-60). Never merged.
describe("CI failure check", () => {
  it("fails on purpose", () => {
    assert.strictEqual(1, 2);
  });
});
