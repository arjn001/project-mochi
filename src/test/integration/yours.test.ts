import * as assert from "node:assert";
import * as vscode from "vscode";
import { yoursActions } from "../../yours/actions";

// What the "Make it yours" page saves (MOCHI-43), in real VS Code.

const mochi = () => vscode.workspace.getConfiguration("mochi");

// Mochi's answers about the brain and her key, faked.
const actionsWith = (brain?: string, hasKey = false) =>
  yoursActions({ brain: async () => brain, hasClaudeKey: async () => hasKey });

describe("Make it yours: saving", () => {
  afterEach(async () => {
    for (const setting of ["speakUp", "learningMode", "focusMinutes", "lateHour"]) {
      await mochi().update(setting, undefined, vscode.ConfigurationTarget.Global);
    }
  });

  it("saves each change in her user settings, never a project's", async () => {
    const actions = actionsWith();
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
    const actions = actionsWith();
    const result = await actions.edit("lateHour", "25");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(mochi().inspect("lateHour")?.globalValue, undefined);
  });

  it("shows the settings as they are now, including changes made elsewhere", async () => {
    await mochi().update("focusMinutes", 30, vscode.ConfigurationTarget.Global);
    const state = await actionsWith().state();
    const fields = state.sections.flatMap((section) => section.fields);
    const focus = fields.find((field) => field.kind === "number" && field.id === "focusMinutes");
    assert.strictEqual(focus?.kind === "number" && focus.value, 30);
  });

  describe("your brain", () => {
    const brainSection = async (brain?: string, hasKey = false) => {
      const state = await actionsWith(brain, hasKey).state();
      const field = state.sections.flatMap((section) => section.fields).find((f) => f.kind === "actions");
      assert.ok(field?.kind === "actions");
      return { field, page: JSON.stringify(state) };
    };

    it("names the brain Mochi thinks with now, and offers to add a Claude key", async () => {
      const { field } = await brainSection("Copilot · Auto");
      assert.match(field.now, /Copilot · Auto/);
      assert.deepStrictEqual(field.buttons.map((b) => b.id), ["chooseBrain", "addClaudeKey"]);
    });

    it("offers to remove the key once there is one, and never shows the key itself", async () => {
      const { field, page } = await brainSection("Claude Haiku 4.5", true);
      assert.deepStrictEqual(field.buttons.map((b) => b.id), ["chooseBrain", "removeClaudeKey"]);
      assert.doesNotMatch(page, /sk-ant/);
    });

    it("says Mochi will ask first when there's no brain to name", async () => {
      const { field } = await brainSection(undefined);
      assert.doesNotMatch(field.now, /undefined/);
    });
  });
});
