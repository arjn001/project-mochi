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
    it("no longer has the temporary Ask command: the panel's box replaced it", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(!commands.includes("mochi.ask"));
    });

    it("registers Choose a brain", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("mochi.chooseBrain"));
    });

    it("registers Add a Claude key", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("mochi.addClaudeKey"));
    });

    it("registers Remove my Claude key", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("mochi.removeClaudeKey"));
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
      assert.strictEqual(await offer(dimAction(), presses("Switch to a dark theme", undefined)), "done");
      assert.strictEqual(theme(), "Dark Modern");
    });

    it("leaves the theme alone when she says Not now", async () => {
      assert.strictEqual(await offer(dimAction(), presses("Not now")), "declined");
      assert.strictEqual(theme(), "Light Modern");
    });

    it("puts her old theme back with Undo", async () => {
      assert.strictEqual(await offer(dimAction(), presses("Switch to a dark theme", "Undo")), "undone");
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

  describe("the panel", () => {
    it("opens and shows, with its script running", async () => {
      const api = (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
      await vscode.commands.executeCommand("mochi.open");
      assert.strictEqual(await api.panel!.whenVisible(10_000, true), true, "The panel's script never said it was ready.");
    });
  });

  describe("the chat", () => {
    it("answers 'hi' with no brain: the kind line and its chip, and her text comes back", async () => {
      const api = (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
      // The test copy of VS Code has no Copilot and no Claude key.
      assert.strictEqual(await api.ask!("hi"), false, "Not sent, so the panel puts it back in the box.");
      const last = api.chat!.entries().at(-1)!;
      assert.strictEqual(last.from, "mochi");
      assert.strictEqual(last.problem, true);
      assert.strictEqual(last.text, "I'd need a brain to answer that. Want to set one up?");
      assert.deepStrictEqual(last.chips?.choices.map((c) => c.label), ["Set one up"]);
      assert.ok(!api.chat!.entries().some((e) => e.from === "her" && e.text === "hi"), "Her text goes back in the box, not into the chat.");
    });

    it("celebrates \"I finished my homework\" on its own, even with no brain", async () => {
      const api = (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
      assert.strictEqual(await api.ask!("I finished my homework"), true, "Sent, so the box empties.");
      const [her, mochi] = api.chat!.entries().slice(-2);
      assert.deepStrictEqual([her.from, her.text], ["her", "I finished my homework"]);
      assert.strictEqual(mochi.from, "mochi");
      assert.match(mochi.text, /your homework/i);
      assert.ok(!mochi.problem, "Not the no-brain line.");
    });

    it("asks her to select code first when she taps Check my work with nothing selected", async () => {
      const api = (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await api.ask!("I finished question 3");
      const celebration = api.chat!.entries().at(-1)!;
      const check = celebration.chips!.choices.find((c) => c.label === "Check my work")!;
      api.chat!.choose(celebration.id, check.id);
      await new Promise((done) => setTimeout(done, 100));
      const last = api.chat!.entries().at(-1)!;
      assert.strictEqual(last.text, "Select the code you'd like me to check, then tap Check my work again.");
      assert.ok(last.chips?.choices.some((c) => c.label === "Check my work"), "The chips stay, so she can tap it again.");
    });

    it("sends \"done, I give up\" to the brain instead of celebrating", async () => {
      const api = (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
      await api.ask!("done, I give up");
      const last = api.chat!.entries().at(-1)!;
      assert.strictEqual(last.text, "I'd need a brain to answer that. Want to set one up?");
    });

    it("shows a chip for the selected lines, and leaves them out after the x", async () => {
      const api = (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
      const doc = await vscode.workspace.openTextDocument({ language: "python", content: "x = 1\ny = 2\nprint(x + y)\n" });
      const editor = await vscode.window.showTextDocument(doc);
      editor.selection = new vscode.Selection(0, 0, 2, 0);
      assert.deepStrictEqual(api.attachment!.shown(), {
        label: "an untitled file, lines 1 to 2",
        leaveOut: "Leave out an untitled file, lines 1 to 2",
      });
      api.attachment!.leaveOut();
      assert.strictEqual(api.attachment!.shown(), undefined);
      assert.deepStrictEqual(api.attachment!.attached(), []);
      // Selecting something else brings it back.
      editor.selection = new vscode.Selection(2, 0, 2, 5);
      assert.strictEqual(api.attachment!.shown()?.label, "an untitled file, line 3");
      await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    });

    it("clears an empty chat without asking, and registers Clear chat", async () => {
      const api = (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
      assert.ok((await vscode.commands.getCommands(true)).includes("mochi.clearChat"));
      await api.memory!.clear();
      await vscode.commands.executeCommand("mochi.clearChat");
      assert.deepStrictEqual(api.chat!.entries(), []);
    });

    it("forgets the chat with Forget everything", async () => {
      const api = (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
      await api.chat!.problem("A line to forget.");
      await api.memory!.forgetAll();
      assert.deepStrictEqual(api.chat!.entries(), []);
    });
  });

  describe("the first-run welcome", () => {
    it("welcomed this fresh profile once, and never again", async () => {
      const api = (await vscode.extensions.getExtension<MochiApi>("arjungyawali.mochi-companion")!.activate()) as MochiApi;
      assert.strictEqual(await api.welcomer!.welcome(), undefined, "Already welcomed when Mochi started.");
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
