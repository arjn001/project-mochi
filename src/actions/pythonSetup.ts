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
  createFailedMessage,
  foldersInOrder,
  isMacPlaceholder,
  isPythonProjectFile,
  parsePythonVersion,
  pythonCandidates,
  pythonExtensionWillPrompt,
  remoteLabel,
  shouldLookForPython,
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

type StepResult = "done" | "failed" | "stopped";

// Runs one step as a VS Code task, so she can watch it in the terminal
// panel. Cancelling the token stops it.
async function runStep(
  folder: vscode.WorkspaceFolder,
  name: string,
  command: string,
  args: string[],
  token?: vscode.CancellationToken
): Promise<StepResult> {
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
    let stopped = false;
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
        resolve(stopped ? "stopped" : exitCode === 0 ? "done" : "failed");
      }
    });
    vscode.tasks.executeTask(task).then(
      (execution) =>
        token?.onCancellationRequested(() => {
          stopped = true;
          execution.terminate();
        }),
      () => {
        processEnded.dispose();
        taskEnded.dispose();
        resolve("failed");
      }
    );
  });
}

// A progress notification while a step runs. A cancellable one gets a
// Cancel button, for long installs or slow networks.
const withProgress = <T>(title: string, cancellable: boolean, work: (token: vscode.CancellationToken) => Thenable<T>) =>
  vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable }, (_progress, token) =>
    work(token)
  );

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
      const result = await withProgress(pythonStrings.installing, true, (token) =>
        runStep(folder, "Install packages", python, ["-m", "pip", "install", "-r", "requirements.txt"], token)
      );
      if (result === "failed") {
        void vscode.window.showWarningMessage(pythonStrings.installFailed);
      } else if (result === "stopped") {
        void vscode.window.showInformationMessage(pythonStrings.installStopped);
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
      try {
        await vscode.workspace.fs.writeFile(file, Buffer.from(withVenvIgnored(before), "utf8"));
      } catch {
        void vscode.window.showWarningMessage(pythonStrings.gitignoreFailed);
      }
      return undefined;
    },
  });
  await offer(ignore, choose);
}

// Creates .venv, then offers the packages and .gitignore. Returns how to
// undo it, or undefined if creating .venv didn't work.
async function setUp(folder: vscode.WorkspaceFolder, python: FoundPython, choose: Choose): Promise<Undo | undefined> {
  const created = await withProgress(pythonStrings.creating, false, () =>
    runStep(folder, `Create ${VENV}`, python.command, [...python.args, "-m", "venv", VENV])
  );
  if (created !== "done") {
    void vscode.window.showWarningMessage(createFailedMessage(process.platform));
    return undefined;
  }
  await offerInstall(folder, choose);
  await offerGitignore(folder, python.version, choose);
  return () => removeVenv(folder, choose);
}

// Undo moves .venv to the Trash, so nothing is lost for good. Remote
// machines and containers often have no Trash; then Mochi asks before
// deleting for good.
async function removeVenv(folder: vscode.WorkspaceFolder, choose: Choose): Promise<void> {
  const venv = vscode.Uri.joinPath(folder.uri, VENV);
  try {
    await vscode.workspace.fs.delete(venv, { recursive: true, useTrash: true });
    return;
  } catch {
    // No Trash here, or the folder is locked. Ask below.
  }
  if ((await choose(pythonStrings.noTrash, [pythonStrings.deleteIt, pythonStrings.keepIt])) !== pythonStrings.deleteIt) {
    return;
  }
  try {
    await vscode.workspace.fs.delete(venv, { recursive: true, useTrash: false });
  } catch {
    void vscode.window.showWarningMessage(pythonStrings.undoFailed);
  }
}

async function tellNoPython(): Promise<void> {
  const where = remoteLabel(vscode.env.remoteName);
  if (where) {
    void vscode.window.showInformationMessage(pythonStrings.noPythonRemote(where, process.platform === "linux"));
    return;
  }
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
  let project: Project;
  try {
    project = await readProject(folder.uri);
  } catch {
    void vscode.window.showWarningMessage(pythonStrings.cantRead);
    return;
  }
  const b = blocker(project);
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

// The only folder, or her pick when there are several. Only folder names
// are shown, never full paths.
async function pickFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length <= 1) {
    return folders[0];
  }
  const editor = vscode.window.activeTextEditor;
  const active = editor ? vscode.workspace.getWorkspaceFolder(editor.document.uri) : undefined;
  const picked = await vscode.window.showQuickPick(
    foldersInOrder(folders, active).map((folder) => ({
      label: folder.name,
      description: folder === active ? pythonStrings.workingHere : undefined,
      folder,
    })),
    { placeHolder: pythonStrings.pickFolder }
  );
  return picked?.folder;
}

export function registerPythonSetup(choose: Choose): vscode.Disposable {
  return vscode.commands.registerCommand("mochi.setUpPython", async () => {
    // Checked first, so Restricted Mode never even looks for a folder to run in.
    if (!vscode.workspace.isTrusted) {
      void tellBlocked(pythonStrings.untrusted, true);
      return;
    }
    // A single file opened without a folder: a venv needs a project folder.
    if (!vscode.workspace.workspaceFolders?.length) {
      void vscode.window.showInformationMessage(pythonStrings.noFolder, pythonStrings.openFolder).then((choice) => {
        if (choice === pythonStrings.openFolder) {
          void vscode.commands.executeCommand("workbench.action.files.openFolder");
        }
      });
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

// What the watcher remembers while VS Code is open.
interface Watch {
  state: vscode.Memento;
  choose: Choose;
  isFocusing: () => boolean;
  // When Mochi last looked for Python and didn't find it.
  lastMissAt?: number;
}

async function lookForPython(watch: Watch): Promise<FoundPython | undefined> {
  if (!shouldLookForPython(watch.lastMissAt, Date.now())) {
    return undefined;
  }
  const python = await findPython();
  watch.lastMissAt = python ? undefined : Date.now();
  return python;
}

// Offers to set up one folder, if it's time. True if Mochi offered.
async function offerFor(folder: vscode.WorkspaceFolder, watch: Watch): Promise<boolean> {
  const offered = watch.state.get<string[]>(OFFERED, []);
  // Cheapest check first, so saving files in a project Mochi already
  // offered for costs nothing.
  if (offered.includes(folder.uri.toString())) {
    return false;
  }
  const project = await readProject(folder.uri);
  const check = {
    project,
    speakUp: readSpeakUp(),
    offeredBefore: false,
    looksLikePython: await looksLikePython(folder, project),
    focusing: watch.isFocusing(),
    pythonExtensionWillPrompt: pythonExtensionWillPrompt({
      installed: vscode.extensions.getExtension("ms-python.python") !== undefined,
      trigger: vscode.workspace.getConfiguration("python", folder.uri).get("createEnvironment.trigger"),
      topLevel: project.topLevel,
    }),
  };
  // Everything else first, so Python is only looked for when it matters.
  if (!shouldOffer({ ...check, pythonFound: true })) {
    return false;
  }
  const python = await lookForPython(watch);
  if (!python) {
    return false;
  }
  // Saved before asking, so it's never offered twice, whatever she answers.
  await watch.state.update(OFFERED, [...offered, folder.uri.toString()]);
  await offer(setUpAction(folder, python, watch.choose), watch.choose);
  return true;
}

// Offers once per project: when she opens one that needs setting up, trusts
// or adds a folder, or saves a Python file (so a folder that was empty when
// she opened it still gets the offer). One offer at a time.
export function watchPythonProjects(state: vscode.Memento, choose: Choose, isFocusing: () => boolean): vscode.Disposable {
  const watch: Watch = { state, choose, isFocusing };
  let busy = false;
  const check = async () => {
    if (busy) {
      return;
    }
    busy = true;
    try {
      for (const folder of vscode.workspace.workspaceFolders ?? []) {
        if (await offerFor(folder, watch)) {
          break;
        }
      }
    } catch {
      // Mochi started this on its own, so a problem (like a folder deleted
      // mid-check) stays quiet instead of popping up an error.
    } finally {
      busy = false;
    }
  };
  void check();
  return vscode.Disposable.from(
    vscode.workspace.onDidGrantWorkspaceTrust(check),
    vscode.workspace.onDidChangeWorkspaceFolders(check),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isPythonProjectFile(doc.fileName)) {
        void check();
      }
    }),
    vscode.workspace.onDidCreateFiles((event) => {
      if (event.files.some((file) => isPythonProjectFile(file.path))) {
        void check();
      }
    })
  );
}
