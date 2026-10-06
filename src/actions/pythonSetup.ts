import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { readSpeakUp } from "../settings";
import { pythonStrings } from "../strings";
import { Choose, UNDO, Undo, defineAction, offer } from "./confirm";
import {
  ENV_FOLDERS,
  Project,
  PythonCommand,
  VENV,
  Version,
  blocker,
  blockerMessage,
  countRequirements,
  isMacPlaceholder,
  parsePythonVersion,
  pythonCandidates,
  shouldOffer,
  shouldOfferGitignore,
  venvCommand,
  venvPython,
  withVenvIgnored,
} from "./pythonProject";

export interface FoundPython extends PythonCommand {
  version: Version;
}

// Runs a quick program, like "python3 --version", without a shell. The exit
// code is undefined if it couldn't start at all.
function run(command: string, args: string[], cwd?: string): Promise<{ code: number | undefined; output: string }> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, timeout: 10_000 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : undefined) : 0;
      resolve({ code, output: `${stdout}${stderr}` });
    });
  });
}

// Where a command would run from, following PATH.
function onPath(command: string): string | undefined {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(dir, command);
    if (dir && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export async function findPython(platform: string = process.platform): Promise<FoundPython | undefined> {
  for (const candidate of pythonCandidates(platform)) {
    if (platform === "darwin") {
      const resolved = onPath(candidate.command);
      const hasDevTools = resolved === "/usr/bin/python3" && (await run("/usr/bin/xcode-select", ["-p"])).code === 0;
      if (isMacPlaceholder(platform, resolved, hasDevTools)) {
        continue;
      }
    }
    const version = parsePythonVersion((await run(candidate.command, [...candidate.args, "--version"])).output);
    if (version?.major === 3) {
      return { ...candidate, version };
    }
  }
  return undefined;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

// What Mochi needs to know about a project folder before setting it up.
export async function readProject(folder: vscode.Uri): Promise<Project> {
  const topLevel = (await vscode.workspace.fs.readDirectory(folder)).map(([name]) => name);
  const envFolders: string[] = [];
  for (const name of ENV_FOLDERS) {
    if (await exists(vscode.Uri.joinPath(folder, name, "pyvenv.cfg"))) {
      envFolders.push(name);
    }
  }
  return { trusted: vscode.workspace.isTrusted, topLevel, envFolders };
}

// Runs one step as a VS Code task, so she can watch it in the terminal
// panel. True if it worked.
async function runStep(folder: vscode.WorkspaceFolder, name: string, command: string, args: string[]): Promise<boolean> {
  const id = `${name}-${Date.now()}`;
  const task = new vscode.Task(
    { type: "mochi", step: id },
    folder,
    name,
    "Mochi",
    new vscode.ProcessExecution(command, args, { cwd: folder.uri.fsPath })
  );
  task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, focus: false, clear: true };

  return new Promise((resolve) => {
    let exitCode: number | undefined;
    const ours = (e: { execution: vscode.TaskExecution }) => e.execution.task.definition.step === id;
    const processEnded = vscode.tasks.onDidEndTaskProcess((e) => {
      if (ours(e)) {
        exitCode = e.exitCode;
      }
    });
    const taskEnded = vscode.tasks.onDidEndTask((e) => {
      if (ours(e)) {
        processEnded.dispose();
        taskEnded.dispose();
        resolve(exitCode === 0);
      }
    });
    vscode.tasks.executeTask(task).then(undefined, () => {
      processEnded.dispose();
      taskEnded.dispose();
      resolve(false);
    });
  });
}

const withProgress = <T>(title: string, work: () => Thenable<T>) =>
  vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, work);

// Installing downloads and runs code she didn't directly ask for, so it's
// offered, never assumed.
async function offerInstall(folder: vscode.WorkspaceFolder, choose: Choose): Promise<void> {
  const file = vscode.Uri.joinPath(folder.uri, "requirements.txt");
  if (!(await exists(file))) {
    return;
  }
  const count = countRequirements(Buffer.from(await vscode.workspace.fs.readFile(file)).toString("utf8"));
  if (count === 0) {
    return;
  }
  const python = path.join(folder.uri.fsPath, ...venvPython(process.platform));
  const install = defineAction({
    question: pythonStrings.installQuestion(count),
    yes: pythonStrings.installYes,
    // No Undo here, so offer() never shows a done message.
    done: "",
    act: async () => {
      const ok = await withProgress(pythonStrings.installing, () =>
        runStep(folder, "Install packages", python, ["-m", "pip", "install", "-r", "requirements.txt"])
      );
      if (!ok) {
        void vscode.window.showWarningMessage(pythonStrings.installFailed);
      }
      return undefined;
    },
  });
  await offer(install, choose);
}

// Only for Python older than 3.13, in a git repo that doesn't ignore .venv
// yet. Changing her files is asked first.
async function offerGitignore(folder: vscode.WorkspaceFolder, version: Version, choose: Choose): Promise<void> {
  // git check-ignore: 0 means ignored, 1 means not ignored, anything else
  // means not a git repo (or no git).
  const { code } = await run("git", ["check-ignore", "-q", VENV], folder.uri.fsPath);
  if (!shouldOfferGitignore({ inGitRepo: code === 0 || code === 1, ignored: code === 0, version })) {
    return;
  }
  const file = vscode.Uri.joinPath(folder.uri, ".gitignore");
  const ignore = defineAction({
    question: pythonStrings.gitignore,
    yes: pythonStrings.gitignoreYes,
    // No Undo here, so offer() never shows a done message.
    done: "",
    act: async () => {
      const before = (await exists(file))
        ? Buffer.from(await vscode.workspace.fs.readFile(file)).toString("utf8")
        : undefined;
      await vscode.workspace.fs.writeFile(file, Buffer.from(withVenvIgnored(before), "utf8"));
      return undefined;
    },
  });
  await offer(ignore, choose);
}

// Creates .venv, then offers the packages and .gitignore. Returns how to
// undo it, or undefined if creating .venv didn't work.
async function setUp(folder: vscode.WorkspaceFolder, python: FoundPython, choose: Choose): Promise<Undo | undefined> {
  const created = await withProgress(pythonStrings.creating, () =>
    runStep(folder, `Create ${VENV}`, python.command, [...python.args, "-m", "venv", VENV])
  );
  if (!created) {
    void vscode.window.showWarningMessage(pythonStrings.createFailed);
    return undefined;
  }
  await offerInstall(folder, choose);
  await offerGitignore(folder, python.version, choose);
  // Undo moves .venv to the Trash, so nothing is lost for good.
  return async () => {
    await vscode.workspace.fs.delete(vscode.Uri.joinPath(folder.uri, VENV), { recursive: true, useTrash: true });
  };
}

async function tellNoPython(): Promise<void> {
  if ((await vscode.window.showInformationMessage(pythonStrings.noPython, pythonStrings.getPython)) === pythonStrings.getPython) {
    await vscode.env.openExternal(vscode.Uri.parse("https://www.python.org/downloads/"));
  }
}

async function tellBlocked(message: string, untrusted: boolean): Promise<void> {
  if (!untrusted) {
    void vscode.window.showInformationMessage(message);
    return;
  }
  if ((await vscode.window.showInformationMessage(message, pythonStrings.manageTrust)) === pythonStrings.manageTrust) {
    await vscode.commands.executeCommand("workbench.trust.manage");
  }
}

// She asked for this from the Command Palette, so creating .venv isn't
// confirmed again (see PRESENCE.md). Undo is offered after.
export async function setUpPython(folder: vscode.WorkspaceFolder, choose: Choose): Promise<void> {
  const b = blocker(await readProject(folder.uri));
  if (b) {
    void tellBlocked(blockerMessage(b), b.kind === "untrusted");
    return;
  }
  const python = await findPython();
  if (!python) {
    void tellNoPython();
    return;
  }
  const undo = await setUp(folder, python, choose);
  if (undo && (await choose(pythonStrings.done(venvCommand(python)), [UNDO])) === UNDO) {
    await undo();
  }
}

// When Mochi offers on its own, it asks first, like every action.
export function setUpAction(folder: vscode.WorkspaceFolder, python: FoundPython, choose: Choose) {
  return defineAction({
    question: pythonStrings.offer,
    yes: pythonStrings.offerYes,
    done: pythonStrings.done(venvCommand(python)),
    act: () => setUp(folder, python, choose),
  });
}

// The folder she's working in: the active file's, the only one, or her pick.
async function pickFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const active = vscode.window.activeTextEditor?.document.uri;
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (active && vscode.workspace.getWorkspaceFolder(active)) {
    return vscode.workspace.getWorkspaceFolder(active);
  }
  return folders.length <= 1 ? folders[0] : vscode.window.showWorkspaceFolderPick({ placeHolder: "Which project should I set up?" });
}

export function registerPythonSetup(choose: Choose): vscode.Disposable {
  return vscode.commands.registerCommand("mochi.setUpPython", async () => {
    // Checked first, so Restricted Mode never even looks for a folder to run in.
    if (!vscode.workspace.isTrusted) {
      void tellBlocked(pythonStrings.untrusted, true);
      return;
    }
    if (!vscode.workspace.workspaceFolders?.length) {
      void vscode.window.showInformationMessage(pythonStrings.noFolder);
      return;
    }
    const folder = await pickFolder();
    if (folder) {
      await setUpPython(folder, choose);
    }
  });
}

// The projects Mochi has offered to set up, kept per workspace. Only folder
// addresses, nothing about her code.
const OFFERED = "mochi.pythonSetupOffered";

async function looksLikePython(folder: vscode.WorkspaceFolder, project: Project): Promise<boolean> {
  if (project.topLevel.includes("requirements.txt") || project.topLevel.includes("pyproject.toml")) {
    return true;
  }
  const skip = "**/{.venv,venv,env,node_modules,.git}/**";
  return (await vscode.workspace.findFiles(new vscode.RelativePattern(folder, "**/*.py"), skip, 1)).length > 0;
}

// Offers to set up one folder, if it's time. True if Mochi offered.
async function offerFor(folder: vscode.WorkspaceFolder, state: vscode.Memento, choose: Choose): Promise<boolean> {
  const offered = state.get<string[]>(OFFERED, []);
  const project = await readProject(folder.uri);
  const check = {
    project,
    speakUp: readSpeakUp(),
    offeredBefore: offered.includes(folder.uri.toString()),
    looksLikePython: await looksLikePython(folder, project),
  };
  // Everything else first, so Python is only looked for when it matters.
  if (!shouldOffer({ ...check, pythonFound: true })) {
    return false;
  }
  const python = await findPython();
  if (!python) {
    return false;
  }
  // Saved before asking, so it's never offered twice, whatever she answers.
  await state.update(OFFERED, [...offered, folder.uri.toString()]);
  await offer(setUpAction(folder, python, choose), choose);
  return true;
}

// Offers once per project when she opens one that needs setting up, and
// again when she trusts a folder or adds one. One offer at a time.
export function watchPythonProjects(state: vscode.Memento, choose: Choose): vscode.Disposable {
  let busy = false;
  const check = async () => {
    if (busy) {
      return;
    }
    busy = true;
    try {
      for (const folder of vscode.workspace.workspaceFolders ?? []) {
        if (await offerFor(folder, state, choose)) {
          break;
        }
      }
    } finally {
      busy = false;
    }
  };
  void check();
  return vscode.Disposable.from(
    vscode.workspace.onDidGrantWorkspaceTrust(check),
    vscode.workspace.onDidChangeWorkspaceFolders(check)
  );
}
