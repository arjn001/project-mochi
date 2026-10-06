// Developer tools, for trying things before their real screens exist.
//
// Loaded only when Mochi runs from source (Run > Start Debugging), never in
// the published extension: extension.ts checks the extension mode, nothing
// in package.json mentions these, and out/dev/ is left out of the .vsix
// (.vscodeignore, checked in CI). She never sees this text, so it stays here
// instead of in strings.ts.
import * as vscode from "vscode";
import { PersonalLayer } from "../packs/personalLayer";

const LOAD = "Load a personal layer from a JSON file...";
const SHOW = "Show the current personal layer";
const CLEAR = "Clear the personal layer";

async function loadLayer(personal: PersonalLayer): Promise<void> {
  const [file] =
    (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { "Personal layer": ["json"] } })) ?? [];
  if (!file) {
    return;
  }
  let input: unknown;
  try {
    input = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(file)).toString("utf8"));
  } catch (error) {
    void vscode.window.showErrorMessage(`Mochi dev: that isn't valid JSON. ${String(error)}`);
    return;
  }
  // The same strict checks as a gift file.
  const result = await personal.save(input);
  if (result.ok) {
    void vscode.window.showInformationMessage("Mochi dev: personal layer loaded. Try Mochi: Say Hello, or ask something.");
  } else {
    void vscode.window.showErrorMessage(`Mochi dev: the layer was rejected. ${result.errors.join(" ")}`, { modal: true });
  }
}

export function registerDevTools(personal: PersonalLayer): vscode.Disposable {
  const menu = vscode.commands.registerCommand("mochi.dev.menu", async () => {
    const choice = await vscode.window.showQuickPick([LOAD, SHOW, CLEAR], { placeHolder: "Mochi developer tools" });
    if (choice === LOAD) {
      await loadLayer(personal);
    } else if (choice === SHOW) {
      const doc = await vscode.workspace.openTextDocument({
        language: "json",
        content: JSON.stringify(personal.layer() ?? null, null, 2),
      });
      await vscode.window.showTextDocument(doc);
    } else if (choice === CLEAR) {
      await personal.clear();
      void vscode.window.showInformationMessage("Mochi dev: personal layer cleared.");
    }
  });

  // A beaker in the status bar of the development window only.
  const item = vscode.window.createStatusBarItem("mochi.dev", vscode.StatusBarAlignment.Left);
  item.name = "Mochi developer tools";
  item.text = "$(beaker) Mochi dev";
  item.tooltip = "Mochi developer tools (development only)";
  item.command = "mochi.dev.menu";
  item.show();

  return vscode.Disposable.from(menu, item);
}
