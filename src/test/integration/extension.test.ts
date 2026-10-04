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
});
