// The rules for setting up a Python project (MOCHI-28). Plain code with no
// VS Code dependency, so it can be unit tested alone.
//
// Creating .venv is what she asks for, so it isn't confirmed again.
// Installing requirements.txt downloads and runs code she didn't directly
// ask for, so Mochi asks first. Same for changing .gitignore.
import { maySpeak } from "../moments/gatekeeper";
import { pythonStrings } from "../strings";

// Where Mochi creates the virtual environment. The standard name, which the
// Python extension finds on its own.
export const VENV = ".venv";

// Folders that already hold a virtual environment, if they have a
// pyvenv.cfg inside.
export const ENV_FOLDERS = [".venv", "venv", "env"];

// Projects that use another tool for their environment. Mochi leaves those
// to that tool.
export const OTHER_TOOLS = [
  { file: "environment.yml", tool: "conda" },
  { file: "Pipfile", tool: "Pipenv" },
  { file: "poetry.lock", tool: "Poetry" },
  { file: "uv.lock", tool: "uv" },
];

export interface Project {
  trusted: boolean;
  // The names of the files and folders at the top of the project.
  topLevel: string[];
  // Which of ENV_FOLDERS have a pyvenv.cfg inside.
  envFolders: string[];
}

// Why Mochi won't set this project up.
export type Blocker =
  | { kind: "untrusted" }
  | { kind: "otherTool"; file: string; tool: string }
  | { kind: "hasEnvironment"; folder: string };

export function blocker(project: Project): Blocker | undefined {
  // Restricted Mode: never run anything in a folder she hasn't trusted.
  if (!project.trusted) {
    return { kind: "untrusted" };
  }
  const other = OTHER_TOOLS.find((t) => project.topLevel.includes(t.file));
  if (other) {
    return { kind: "otherTool", ...other };
  }
  const env = ENV_FOLDERS.find((f) => project.envFolders.includes(f));
  if (env) {
    return { kind: "hasEnvironment", folder: env };
  }
  return undefined;
}

// What Mochi says instead of setting up.
export function blockerMessage(b: Blocker): string {
  switch (b.kind) {
    case "untrusted":
      return pythonStrings.untrusted;
    case "otherTool":
      return pythonStrings.otherTool(b.tool, b.file);
    case "hasEnvironment":
      return pythonStrings.hasEnvironment(b.folder);
  }
}

export interface OfferCheck {
  project: Project;
  speakUp: unknown;
  // Mochi offers once per project, ever.
  offeredBefore: boolean;
  // Has .py files, requirements.txt, or pyproject.toml.
  looksLikePython: boolean;
  pythonFound: boolean;
  // A focus session she started. The offer waits until it ends.
  focusing: boolean;
  // The Python extension will ask about the same thing, so Mochi steps aside.
  pythonExtensionWillPrompt: boolean;
}

// Whether Mochi offers on its own to set up this project.
export function shouldOffer(check: OfferCheck): boolean {
  return (
    check.looksLikePython &&
    check.pythonFound &&
    !check.offeredBefore &&
    !check.focusing &&
    !check.pythonExtensionWillPrompt &&
    blocker(check.project) === undefined &&
    maySpeak({ place: "nudge" }, check.speakUp)
  );
}

export interface PythonExtension {
  installed: boolean;
  // Its python.createEnvironment.trigger setting: "prompt" (the default) or
  // "off".
  trigger: unknown;
  // The names of the files at the top of the project.
  topLevel: string[];
}

// Whether Microsoft's Python extension will offer to create an environment
// itself. Checked against its code (version 2026.6.0): it prompts when its
// trigger isn't "off" and the project has a requirements file (and, like
// Mochi, no environment and no other tool).
export function pythonExtensionWillPrompt(ext: PythonExtension): boolean {
  return ext.installed && ext.trigger !== "off" && ext.topLevel.some((name) => /^requirements.*\.txt$/i.test(name));
}

// Saving one of these makes Mochi look again, so a folder that was empty
// when she opened it still gets the offer once she starts writing Python.
export function isPythonProjectFile(fileName: string): boolean {
  const name = fileName.split(/[\\/]/).pop() ?? "";
  return name.endsWith(".py") || name === "requirements.txt" || name === "pyproject.toml";
}

// After not finding Python, Mochi waits this long before looking again, so
// saving a file doesn't start a program every time.
export const PYTHON_RECHECK_MS = 10 * 60_000;

export function shouldLookForPython(lastMissAt: number | undefined, now: number): boolean {
  return lastMissAt === undefined || now - lastMissAt >= PYTHON_RECHECK_MS;
}

// What to call the machine Mochi is running on in a remote setup, from
// VS Code's remote name. Undefined when she's working locally.
export function remoteLabel(remoteName: string | undefined): string | undefined {
  switch (remoteName) {
    case undefined:
      return undefined;
    case "ssh-remote":
      return "SSH machine";
    case "wsl":
      return "WSL distro";
    case "dev-container":
    case "attached-container":
      return "container";
    case "codespaces":
      return "codespace";
    default:
      return "remote machine";
  }
}

// How to run Python on her system, in the order Mochi tries them.
export interface PythonCommand {
  command: string;
  args: string[];
}

export function pythonCandidates(platform: string): PythonCommand[] {
  return platform === "win32"
    ? [
        { command: "py", args: ["-3"] },
        { command: "python", args: [] },
      ]
    : [
        { command: "python3", args: [] },
        { command: "python", args: [] },
      ];
}

export interface Version {
  major: number;
  minor: number;
}

// "Python 3.12.4" becomes 3.12. Anything else, like Windows' "Python was not
// found" message, means no Python.
export function parsePythonVersion(output: string): Version | undefined {
  const match = /^Python (\d+)\.(\d+)/m.exec(output.trim());
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : undefined;
}

// On a Mac without the developer tools, /usr/bin/python3 is only a
// placeholder: running it pops up an installer, which would be Mochi acting
// without asking. So Mochi skips it.
export function isMacPlaceholder(platform: string, resolvedPath: string | undefined, hasDevTools: boolean): boolean {
  return platform === "darwin" && resolvedPath === "/usr/bin/python3" && !hasDevTools;
}

// The command she can type herself next time: "python3 -m venv .venv".
export function venvCommand(python: PythonCommand): string {
  return [python.command, ...python.args, "-m", "venv", VENV].join(" ");
}

// The venv's own Python, inside .venv.
export function venvPython(platform: string): string[] {
  return platform === "win32" ? [VENV, "Scripts", "python.exe"] : [VENV, "bin", "python"];
}

// How many packages requirements.txt lists. Comments, blank lines, and
// options like "--index-url" or "-r other.txt" don't count.
export function countRequirements(text: string): number {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|\s)#.*$/, "").trim())
    .filter((line) => line !== "" && (!line.startsWith("-") || /^(-e|--editable)\s/.test(line))).length;
}

// Python 3.13 and newer put a .gitignore inside .venv, so it ignores itself.
export const venvIgnoresItself = (v: Version) => v.major > 3 || (v.major === 3 && v.minor >= 13);

export interface GitignoreCheck {
  inGitRepo: boolean;
  // Whether git already ignores .venv.
  ignored: boolean;
  version: Version;
}

export function shouldOfferGitignore(check: GitignoreCheck): boolean {
  return check.inGitRepo && !check.ignored && !venvIgnoresItself(check.version);
}

// .gitignore with .venv/ added at the end, on its own line, keeping the
// file's own line endings (Windows files often use \r\n).
export function withVenvIgnored(existing: string | undefined): string {
  const before = existing ?? "";
  const eol = before.includes("\r\n") ? "\r\n" : "\n";
  const gap = before === "" || before.endsWith("\n") ? "" : eol;
  return `${before}${gap}${VENV}/${eol}`;
}

// What to say when creating .venv fails. On Linux (including WSL), the
// usual reason is a missing python3-venv package.
export const createFailedMessage = (platform: string) =>
  platform === "linux" ? pythonStrings.createFailedLinux : pythonStrings.createFailed;
