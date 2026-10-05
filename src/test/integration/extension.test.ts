import * as assert from "node:assert";
import * as vscode from "vscode";

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
});
