import * as assert from "node:assert";
import * as vscode from "vscode";
import type { MochiApi } from "../../extension";

describe("Mochi in VS Code", () => {
  it("registers the Say Hello command", async () => {
    const mochi = vscode.extensions.getExtension("arjungyawali.mochi-companion");
    assert.ok(mochi, "Mochi is not installed in the test window.");

    await mochi.activate();
    const commands = await vscode.commands.getCommands(true);

    assert.ok(
      commands.includes("mochi.sayHello"),
      "Mochi started, but the mochi.sayHello command is not registered."
    );
  });

  it("has a home view that VS Code can open", async () => {
    // VS Code creates this command for every view container.
    const openMochi = "workbench.view.extension.mochi";
    const commands = await vscode.commands.getCommands(true);

    assert.ok(
      commands.includes(openMochi),
      "Mochi's view container is missing. Check viewsContainers in package.json."
    );
    await vscode.commands.executeCommand(openMochi);
  });

  it("opens Mochi's tab with the Open Mochi command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("mochi.open"),
      "The mochi.open command is not registered, so the status bar can't open Mochi."
    );
    await vscode.commands.executeCommand("mochi.open");
  });

  describe("quiet mode", () => {
    const settings = () => vscode.workspace.getConfiguration("mochi");

    // Setting changes reach Mochi a moment later, so wait for the mood line.
    async function moodBecomes(api: MochiApi, expected: string): Promise<string> {
      for (let i = 0; i < 50 && !api.moodText().includes(expected); i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return api.moodText();
    }

    afterEach(async () => {
      await settings().update("speakUp", undefined, vscode.ConfigurationTarget.Global);
    });

    it("naps when she switches to quiet, and purrs again after, with no reload", async () => {
      const api = (await vscode.extensions
        .getExtension<MochiApi>("arjungyawali.mochi-companion")!
        .activate()) as MochiApi;

      await settings().update("speakUp", "quiet", vscode.ConfigurationTarget.Global);
      assert.strictEqual(
        await moodBecomes(api, "napping"),
        "$(mochi-napping) Mochi is napping",
        "After switching to quiet, the mood line should nap."
      );

      await settings().update("speakUp", "gentle", vscode.ConfigurationTarget.Global);
      assert.strictEqual(
        await moodBecomes(api, "purring"),
        "$(mochi-purring) Mochi is purring",
        "After switching back to gentle, the mood line should purr again."
      );
    });
  });
});
