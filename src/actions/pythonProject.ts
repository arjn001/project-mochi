// The rules for setting up a Python project (MOCHI-28). Plain code with no
// VS Code dependency, so it can be unit tested alone.
//
// Creating .venv is what she asks for, so it isn't confirmed again.
// Installing requirements.txt downloads and runs code she didn't directly
// ask for, so Mochi asks first. Same for changing .gitignore.
import { maySpeak } from "../moments/gatekeeper";

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

export const pythonTexts = {
  noFolder: "Open your project folder first, and I'll set it up.",
  untrusted:
    "This folder is in Restricted Mode, so I won't run anything in it. If you trust it, you can change that, and then I'd love to help.",
  manageTrust: "Manage Workspace Trust",
  noPython: "I couldn't find Python on this computer. Want to install it?",
  getPython: "Get Python",
  offer:
    "This looks like a Python project. Want me to set up a virtual environment? It keeps this project's packages in their own box.",
  offerYes: "Set it up",
  creating: `Setting up a virtual environment in ${VENV}...`,
  createFailed: `Hmm, setting up ${VENV} didn't work. The terminal shows what happened.`,
  installYes: "Install",
  installing: "Installing the packages from requirements.txt...",
  installFailed: "Some packages didn't install. The terminal shows what happened.",
  gitignore: `This project uses git. Want me to add ${VENV} to .gitignore, so it stays out of your commits?`,
  gitignoreYes: "Add it",
};

// What Mochi says instead of setting up.
export function blockerMessage(b: Blocker): string {
  switch (b.kind) {
    case "untrusted":
      return pythonTexts.untrusted;
    case "otherTool":
      return `This project uses ${b.tool} (I spotted ${b.file}), so I'll let ${b.tool} handle its environment.`;
    case "hasEnvironment":
      return `This project already has a virtual environment (${b.folder}). You're all set!`;
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
}

// Whether Mochi offers on its own to set up this project.
export function shouldOffer(check: OfferCheck): boolean {
  return (
    check.looksLikePython &&
    check.pythonFound &&
    !check.offeredBefore &&
    blocker(check.project) === undefined &&
    maySpeak({ place: "nudge" }, check.speakUp)
  );
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

export const doneMessage = (python: PythonCommand) =>
  `Your Python project is all set up in ${VENV}! Next time you can do this yourself with ${venvCommand(python)}`;

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

export const installQuestion = (count: number) =>
  count === 1
    ? "This project lists 1 package in requirements.txt. Install it too?"
    : `This project lists ${count} packages in requirements.txt. Install them too?`;

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

// .gitignore with .venv/ added at the end, on its own line.
export function withVenvIgnored(existing: string | undefined): string {
  const before = existing ?? "";
  const gap = before === "" || before.endsWith("\n") ? "" : "\n";
  return `${before}${gap}${VENV}/\n`;
}
