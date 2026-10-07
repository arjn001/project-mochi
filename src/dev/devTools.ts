// Developer tools, for trying things before their real screens exist.
//
// Loaded only when Mochi runs from source (Run > Start Debugging), never in
// the published extension: extension.ts checks the extension mode, nothing
// in package.json mentions these, and out/dev/ is left out of the .vsix
// (.vscodeignore, checked in CI). She never sees this text, so it stays here
// instead of in strings.ts.
import * as vscode from "vscode";
import { Greeter, projectName } from "../moments/greetingWatcher";
import { PersonalLayer } from "../packs/personalLayer";

const LOAD = "Load a personal layer from a JSON file...";
const SHOW = "Show the current personal layer";
const CLEAR = "Clear the personal layer";
const GREET = "Greet me now (skips once a day)";
const GREET_BACK = "Greet me as if I last coded here 3 days ago";
const BRAINS = "List available brains";
const TRY_BRAIN = "Send a test message to a brain...";

// Every model VS Code's built-in AI offers Mochi: Copilot, models from other
// extensions, and (if VS Code shares them) keys added in "Manage Models".
// Listing them sends nothing to any AI.
async function listBrains(): Promise<void> {
  const models = await vscode.lm.selectChatModels();
  const lines = [
    `# Brains Mochi can see (${models.length})`,
    "",
    `VS Code ${vscode.version}, checked ${new Date().toLocaleString()}.`,
    "",
    "| Vendor | Name | Family | ID | Version | Max input tokens |",
    "|---|---|---|---|---|---|",
    ...models.map((m) => `| ${m.vendor} | ${m.name} | ${m.family} | ${m.id} | ${m.version} | ${m.maxInputTokens} |`),
  ];
  if (models.length === 0) {
    lines.push("", "None. Sign in to Copilot, or install an extension that provides models.");
  }
  const doc = await vscode.workspace.openTextDocument({ language: "markdown", content: lines.join("\n") });
  await vscode.window.showTextDocument(doc);
}

// Whether a brain that shows up actually answers Mochi. This sends one tiny
// message, only because she clicked, and may ask her to Allow it first.
async function tryBrain(): Promise<void> {
  const models = await vscode.lm.selectChatModels();
  const picked = await vscode.window.showQuickPick(
    models.map((m) => ({ label: m.name, description: `${m.vendor} · ${m.id}`, model: m })),
    { placeHolder: models.length ? "Which brain should get a test message?" : "No brains to try" }
  );
  if (!picked) {
    return;
  }
  const started = Date.now();
  try {
    const response = await picked.model.sendRequest(
      [vscode.LanguageModelChatMessage.User("Reply with exactly three words: a friendly hello.")],
      { justification: "Mochi's developer tools are checking that this brain can answer Mochi." }
    );
    let text = "";
    for await (const piece of response.text) {
      text += piece;
    }
    void vscode.window.showInformationMessage(
      `Mochi dev: ${picked.label} answered in ${Date.now() - started} ms: "${text.trim()}"`
    );
  } catch (error) {
    const code = error instanceof vscode.LanguageModelError ? ` (${error.code})` : "";
    void vscode.window.showErrorMessage(`Mochi dev: ${picked.label} didn't answer${code}. ${String(error)}`, {
      modal: true,
    });
  }
}

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
    void vscode.window.showInformationMessage("Mochi dev: personal layer loaded. Try Greet me now from this menu, or ask something.");
  } else {
    void vscode.window.showErrorMessage(`Mochi dev: the layer was rejected. ${result.errors.join(" ")}`, { modal: true });
  }
}

export function registerDevTools(personal: PersonalLayer, greeter: Greeter): vscode.Disposable {
  const menu = vscode.commands.registerCommand("mochi.dev.menu", async () => {
    const choice = await vscode.window.showQuickPick([BRAINS, TRY_BRAIN, GREET, GREET_BACK, LOAD, SHOW, CLEAR], {
      placeHolder: "Mochi developer tools",
    });
    if (choice === BRAINS) {
      await listBrains();
    } else if (choice === TRY_BRAIN) {
      await tryBrain();
    } else if (choice === GREET) {
      await greeter.greet({ force: true });
    } else if (choice === GREET_BACK) {
      await greeter.greet({ force: true, last: { at: Date.now() - 3 * 24 * 60 * 60_000, project: projectName() } });
    } else if (choice === LOAD) {
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
