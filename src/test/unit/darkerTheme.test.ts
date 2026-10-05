import * as assert from "node:assert";
import { skipDimming } from "../../actions/darkerTheme";

describe("dimming with a darker theme", () => {
  it("offers to dim a light theme", () => {
    assert.strictEqual(skipDimming("light"), undefined);
  });

  it("doesn't offer when the theme is already dark", () => {
    assert.match(skipDimming("dark") ?? "", /already on a dark theme/);
  });

  it("never touches a high contrast theme", () => {
    assert.match(skipDimming("highContrast") ?? "", /leave it just as it is/);
  });
});
