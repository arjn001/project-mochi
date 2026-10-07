import * as assert from "node:assert";
import { countsAsError } from "../../problems";

describe("which problems count as errors", () => {
  it("counts every error", () => {
    assert.ok(countsAsError({ severity: "error" }));
    assert.ok(countsAsError({ severity: "error", source: "ts", code: 2304 }));
  });

  it("counts a warning that crashes when the code runs, like an undefined name", () => {
    for (const source of ["Pylance", "Pyright", "basedpyright"]) {
      assert.ok(countsAsError({ severity: "warning", source, code: "reportUndefinedVariable" }), source);
    }
  });

  it("reads codes that come with a documentation link", () => {
    assert.ok(countsAsError({ severity: "warning", source: "Pylance", code: { value: "reportUndefinedVariable" } }));
  });

  it("never counts ordinary warnings, or the same code from another tool", () => {
    assert.ok(!countsAsError({ severity: "warning", source: "Pylance", code: "reportUnusedImport" }));
    assert.ok(!countsAsError({ severity: "warning", source: "Pylance" }));
    assert.ok(!countsAsError({ severity: "warning", source: "eslint", code: "reportUndefinedVariable" }));
  });

  it("never counts hints or information", () => {
    assert.ok(!countsAsError({ severity: "other", source: "Pylance", code: "reportUndefinedVariable" }));
  });
});
