import * as assert from "node:assert";
import * as vscode from "vscode";
import { loadDefaultPack } from "../../packs/defaultPack";
import { PersonalLayer } from "../../packs/personalLayer";
import { yoursActions } from "../../yours/actions";

// What the "Make it yours" page saves (MOCHI-43), in real VS Code.

const mochi = () => vscode.workspace.getConfiguration("mochi");

// Mochi's answers about the brain, her key, and her name, faked.
// Her personal layer is real, kept in a fake store, over the default pack.
function actionsWith(brain?: string, hasKey = false, name?: string) {
  const saved: string[] = [];
  const data = new Map<string, unknown>();
  const pack = loadDefaultPack();
  const personal = new PersonalLayer({ get: (key) => data.get(key), update: async (key, value) => void data.set(key, value) }, pack, () => {});
  const actions = yoursActions({
    brain: async () => brain,
    hasClaudeKey: async () => hasKey,
    name: () => name,
    setName: async (value) => (saved.push(value), { ok: true }),
    layer: () => personal.layer(),
    saveLayer: (layer) => personal.save(layer),
    mochiLines: (moment) => pack.phrases[moment],
  });
  return Object.assign(actions, { savedNames: saved, personal });
}

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

  describe("about you", () => {
    it("saves her name through her personal layer, trimmed", async () => {
      const actions = actionsWith();
      assert.deepStrictEqual(await actions.edit("name", "  Sam "), { ok: true });
      assert.deepStrictEqual(actions.savedNames, ["Sam"]);
    });

    it("keeps a name that doesn't fit out, with the same kind words as \"What should I call you?\"", async () => {
      const actions = actionsWith();
      const result = await actions.edit("name", "x".repeat(31));
      assert.strictEqual(result.ok, false);
      assert.match(result.ok ? "" : result.hint, /30 characters/);
      assert.deepStrictEqual(actions.savedNames, []);
    });

    it("offers Forget my name only once there's a name", async () => {
      const buttons = async (name?: string) =>
        (await actionsWith(undefined, false, name).state()).sections[0].fields.flatMap((f) => (f.kind === "actions" ? f.buttons.map((b) => b.id) : []));
      assert.deepStrictEqual(await buttons(undefined), []);
      assert.deepStrictEqual(await buttons("Sam"), ["forgetName"]);
    });
  });

  describe("Mochi's touches", () => {
    it("saves her own lines for a moment, and Mochi says them right away", async () => {
      const actions = actionsWith();
      assert.deepStrictEqual(await actions.edit("lines.celebrate", "Woohoo, {thing} is done!\n\n  Paws up for {thing}!  "), { ok: true });
      assert.deepStrictEqual(actions.personal.pack().phrases.celebrate, ["Woohoo, {thing} is done!", "Paws up for {thing}!"]);
    });

    it("goes back to Mochi's own lines when she empties the box", async () => {
      const actions = actionsWith();
      await actions.edit("lines.stuck", "Want a paw?");
      await actions.edit("lines.stuck", "  ");
      assert.deepStrictEqual(actions.personal.pack().phrases.stuck, loadDefaultPack().phrases.stuck);
    });

    it("keeps a line this moment can't use out, kindly", async () => {
      const actions = actionsWith();
      const result = await actions.edit("lines.stuck", "Stuck on {thing}?");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(actions.personal.layer(), undefined, "Nothing saved.");
    });

    it("saves her style notes as style only, and keeps her other touches", async () => {
      const actions = actionsWith();
      await actions.edit("lines.stuck", "Want a paw?");
      assert.deepStrictEqual(await actions.edit("style", "  short and calm "), { ok: true });
      assert.strictEqual(actions.personal.layer()?.voice?.style, "short and calm");
      assert.deepStrictEqual(actions.personal.layer()?.phrases?.stuck, ["Want a paw?"]);
    });

    it("shows Mochi's own lines as the example, and hers as the value", async () => {
      const actions = actionsWith();
      await actions.edit("lines.stuck", "Want a paw?");
      const fields = (await actions.state()).sections.flatMap((section) => section.fields);
      const stuck = fields.find((field) => field.kind === "lines" && field.id === "lines.stuck");
      assert.ok(stuck?.kind === "lines");
      assert.deepStrictEqual(stuck.value, ["Want a paw?"]);
      assert.strictEqual(stuck.example, loadDefaultPack().phrases.stuck.join("\n"));
    });
  });
});
