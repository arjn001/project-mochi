import * as assert from "node:assert";
import * as vscode from "vscode";
import { yoursActions } from "../../yours/actions";

// What the "Make it yours" page saves (MOCHI-43), in real VS Code.

const mochi = () => vscode.workspace.getConfiguration("mochi");

describe("Make it yours: saving", () => {
  afterEach(async () => {
    for (const setting of ["speakUp", "learningMode", "focusMinutes", "lateHour"]) {
      await mochi().update(setting, undefined, vscode.ConfigurationTarget.Global);
    }
  });

  it("saves each change in her user settings, never a project's", async () => {
    const actions = yoursActions();
    assert.deepStrictEqual(await actions.edit("focusMinutes", "45"), { ok: true });
    assert.deepStrictEqual(await actions.edit("speakUp", "chatty"), { ok: true });
    assert.deepStrictEqual(await actions.edit("learningMode", false), { ok: true });
    const focus = mochi().inspect("focusMinutes");
    assert.strictEqual(focus?.globalValue, 45);
    assert.strictEqual(focus?.workspaceValue, undefined);
    assert.strictEqual(mochi().inspect("speakUp")?.globalValue, "chatty");
    assert.strictEqual(mochi().inspect("learningMode")?.globalValue, false);
  });

  it("saves nothing when a value doesn't fit, and says why kindly", async () => {
    const actions = yoursActions();
    const result = await actions.edit("lateHour", "25");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(mochi().inspect("lateHour")?.globalValue, undefined);
  });

  it("shows the settings as they are now, including changes made elsewhere", async () => {
    await mochi().update("focusMinutes", 30, vscode.ConfigurationTarget.Global);
    const state = await yoursActions().state();
    const fields = state.sections.flatMap((section) => section.fields);
    const focus = fields.find((field) => field.id === "focusMinutes");
    assert.strictEqual(focus?.kind === "number" && focus.value, 30);
  });
});
