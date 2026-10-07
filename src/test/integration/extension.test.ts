import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { offer } from "../../actions/confirm";
import { findPython, readProject } from "../../actions/pythonSetup";
import { readLearningMode } from "../../settings";
import { dimAction } from "../../actions/theme";
import type { MochiApi } from "../../extension";

describe("Mochi in VS Code", () => {
  it("starts up and registers its commands", async () => {
    const mochi = vscode.extensions.getExtension("arjungyawali.mochi-companion");
    assert.ok(mochi, "Mochi is not installed in the test window.");

    await mochi.activate();
    const commands = await vscode.commands.getCommands(true);

    assert.ok(
      commands.includes("mochi.open"),
      "Mochi started, but the mochi.open command is not registered."
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

  describe("asking Mochi", () => {
    it("registers the Ask command", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("mochi.ask"), "The mochi.ask command is not registered.");
    });

    it("registers Choose a brain", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("mochi.chooseBrain"));
    });

    it("lists the built-in AI's brains without failing when there's no Copilot", async () => {
      // The test copy of VS Code has no Copilot, so there may be no brains.
      assert.ok(Array.isArray(await vscode.lm.selectChatModels()));
    });
  });

  describe("explaining", () => {
    const diagnostics = vscode.languages.createDiagnosticCollection("mochi-test");
    afterEach(() => diagnostics.clear());

    async function lightbulbFor(
      severity: vscode.DiagnosticSeverity,
      from?: { source: string; code: string }
    ): Promise<string[]> {
      const doc = await vscode.workspace.openTextDocument({ content: "x = 1\nprint(y)\n", language: "python" });
      const range = new vscode.Range(1, 6, 1, 7);
      const problem = new vscode.Diagnostic(range, "NameError: name 'y' is not defined", severity);
      problem.source = from?.source;
      problem.code = from?.code;
      diagnostics.set(doc.uri, [problem]);
      const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        "vscode.executeCodeActionProvider",
        doc.uri,
        range
      );
      return (actions ?? []).map((a) => a.title);
    }

    it("registers the explain commands", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("mochi.explainError"));
      assert.ok(commands.includes("mochi.explainSelection"));
    });

    it("offers Explain with Mochi in the lightbulb next to an error", async () => {
      assert.ok((await lightbulbFor(vscode.DiagnosticSeverity.Error)).includes("Explain with Mochi"));
    });

    it("doesn't offer it for ordinary warnings", async () => {
      assert.ok(!(await lightbulbFor(vscode.DiagnosticSeverity.Warning)).includes("Explain with Mochi"));
      const unusedImport = { source: "Pylance", code: "reportUnusedImport" };
      assert.ok(!(await lightbulbFor(vscode.DiagnosticSeverity.Warning, unusedImport)).includes("Explain with Mochi"));
    });

    it("offers it for warnings that crash, like Pylance's undefined name", async () => {
      const undefinedName = { source: "Pylance", code: "reportUndefinedVariable" };
      assert.ok((await lightbulbFor(vscode.DiagnosticSeverity.Warning, undefinedName)).includes("Explain with Mochi"));
    });
  });

  describe("dimming the theme", () => {
    const workbench = () => vscode.workspace.getConfiguration("workbench");
    const theme = () => workbench().inspect<string>("colorTheme")?.globalValue;

    // Theme changes reach VS Code a moment later.
    async function themeKindBecomes(kind: vscode.ColorThemeKind): Promise<void> {
      for (let i = 0; i < 50 && vscode.window.activeColorTheme.kind !== kind; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // A fake "her" who presses the given buttons in turn.
    const presses = (...answers: (string | undefined)[]) => async () => answers.shift();

    beforeEach(async () => {
      await workbench().update("colorTheme", "Light Modern", vscode.ConfigurationTarget.Global);
      await themeKindBecomes(vscode.ColorThemeKind.Light);
    });

    afterEach(async () => {
      await workbench().update("colorTheme", undefined, vscode.ConfigurationTarget.Global);
    });

    it("switches all of VS Code to a darker theme after she says yes", async () => {
      assert.strictEqual(await offer(dimAction(), presses("Dim things", undefined)), "done");
      assert.strictEqual(theme(), "Dark Modern");
    });

    it("leaves the theme alone when she says Not now", async () => {
      assert.strictEqual(await offer(dimAction(), presses("Not now")), "declined");
      assert.strictEqual(theme(), "Light Modern");
    });

    it("puts her old theme back with Undo", async () => {
      assert.strictEqual(await offer(dimAction(), presses("Dim things", "Undo")), "undone");
      assert.strictEqual(theme(), "Light Modern");
    });

    it("doesn't offer when the theme is already dark", async () => {
      await workbench().update("colorTheme", "Dark Modern", vscode.ConfigurationTarget.Global);
      await themeKindBecomes(vscode.ColorThemeKind.Dark);
      assert.strictEqual(await offer(dimAction(), presses(undefined)), "skipped");
    });
  });

  describe("setting up a Python project", () => {
    let folder: string;
    beforeEach(() => {
      folder = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-python-"));
      fs.writeFileSync(path.join(folder, "homework.py"), "print('hi')\n");
    });
    afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

    it("registers the command, and says what to do when no folder is open", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("mochi.setUpPython"), "The mochi.setUpPython command is not registered.");
      // The test window has no folder open, so this only shows a message.
      await vscode.commands.executeCommand("mochi.setUpPython");
    });

    it("finds an environment that's already there by its pyvenv.cfg", async () => {
      fs.mkdirSync(path.join(folder, "venv"));
      fs.writeFileSync(path.join(folder, "venv", "pyvenv.cfg"), "home = /usr/bin\n");
      fs.mkdirSync(path.join(folder, "env"));
      const project = await readProject(vscode.Uri.file(folder));
      assert.deepStrictEqual(project.envFolders, ["venv"], "env/ has no pyvenv.cfg, so it isn't an environment.");
    });

    it("sees files from other tools at the top of the project", async () => {
      fs.writeFileSync(path.join(folder, "poetry.lock"), "");
      const project = await readProject(vscode.Uri.file(folder));
      assert.ok(project.topLevel.includes("poetry.lock"));
    });

    it("looks for Python without failing, and only accepts Python 3", async () => {
      const python = await findPython();
      assert.ok(python === undefined || python.version.major === 3);
    });
  });

  describe("her personal layer", () => {
    async function mochi(): Promise<MochiApi> {
      return (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
    }

    afterEach(async () => (await mochi()).personal!.clear());

    it("registers What should I call you?, Forget my name, and Forget everything", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("mochi.setName"));
      assert.ok(commands.includes("mochi.forgetName"));
      assert.ok(commands.includes("mochi.forgetEverything"));
    });

    it("forgets her layer and greeting memory when asked", async () => {
      const api = await mochi();
      await api.personal!.setName("Sam");
      await api.personal!.forgetAll();
      await api.greeter!.forget();
      assert.strictEqual(api.personal!.pack().user?.name, undefined);
      const text = await api.greeter!.greet({ force: true });
      assert.doesNotMatch(text ?? "", /Sam|Welcome back|Back to/);
    });

    it("keeps her name in Mochi's private storage and uses it right away", async () => {
      const personal = (await mochi()).personal!;
      assert.ok((await personal.setName("Sam")).ok);
      assert.strictEqual(personal.pack().user?.name, "Sam");

      await vscode.commands.executeCommand("mochi.forgetName");
      assert.strictEqual(personal.pack().user?.name, undefined);
    });

    it("never loads the developer tools outside development mode", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(!commands.includes("mochi.dev.menu"), "The developer tools must only exist when running from source.");
    });
  });

  describe("the greeting when VS Code opens", () => {
    const settings = () => vscode.workspace.getConfiguration("mochi");
    async function greeter() {
      return ((await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi)
        .greeter!;
    }

    afterEach(async () => settings().update("speakUp", undefined, vscode.ConfigurationTarget.Global));

    it("says hello, with no project line when no folder is open", async () => {
      const text = await (await greeter()).greet({ force: true });
      assert.match(text ?? "", /^(Meow, good|Good|Hi)/);
      assert.doesNotMatch(text ?? "", /Back to|Picking up/);
    });

    it("greets only once a day, across windows", async () => {
      const g = await greeter();
      await g.greet();
      assert.strictEqual(await g.greet(), undefined, "Already greeted today.");
    });

    it("never greets on its own in quiet mode", async () => {
      await settings().update("speakUp", "quiet", vscode.ConfigurationTarget.Global);
      assert.strictEqual(await (await greeter()).greet(), undefined);
    });
  });

  describe("learning mode", () => {
    const settings = () => vscode.workspace.getConfiguration("mochi");
    afterEach(async () => settings().update("learningMode", undefined, vscode.ConfigurationTarget.Global));

    it("is on by default, and off once she turns it off", async () => {
      assert.strictEqual(readLearningMode(), true);
      await settings().update("learningMode", false, vscode.ConfigurationTarget.Global);
      assert.strictEqual(readLearningMode(), false);
    });
  });

  describe("focus session", () => {
    const settings = () => vscode.workspace.getConfiguration("mochi");

    afterEach(async () => {
      await vscode.commands.executeCommand("mochi.focus.stop");
      await settings().update("speakUp", undefined, vscode.ConfigurationTarget.Global);
      await settings().update("focusMinutes", undefined, vscode.ConfigurationTarget.Global);
    });

    async function mochi(): Promise<MochiApi> {
      return (await vscode.extensions
        .getExtension<MochiApi>("arjungyawali.mochi-companion")!
        .activate()) as MochiApi;
    }

    it("shows the minutes left in the mood line, and goes away when stopped", async () => {
      const api = await mochi();
      await vscode.commands.executeCommand("mochi.focus");
      assert.strictEqual(api.moodText(), "$(mochi-here) Focusing · 25 min left");

      await vscode.commands.executeCommand("mochi.focus.stop");
      assert.strictEqual(api.moodText(), "$(mochi-purring) Mochi is purring");
    });

    it("uses the length from Settings", async () => {
      const api = await mochi();
      await settings().update("focusMinutes", 45, vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand("mochi.focus");
      assert.strictEqual(api.moodText(), "$(mochi-here) Focusing · 45 min left");
    });

    it("still shows in quiet mode, since she started it", async () => {
      const api = await mochi();
      await settings().update("speakUp", "quiet", vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand("mochi.focus");
      assert.strictEqual(api.moodText(), "$(mochi-here) Focusing · 25 min left");
    });
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
