// Every sentence Mochi shows lives here or in the pack, never inline in code
// (see DECISIONS.md), so it can be reviewed in one place and translated
// later (MOCHI-63). Plain code with no VS Code dependency.
//
// Sentences written before this rule still live in their own files; they
// move here as part of MOCHI-63.

export const pythonStrings = {
  noFolder: "Open your project folder first, and I'll set it up.",
  openFolder: "Open Folder",
  untrusted:
    "This folder is in Restricted Mode, so I won't run anything in it. If you trust it, you can change that, and then I'd love to help.",
  manageTrust: "Manage Workspace Trust",
  cantRead: "I couldn't look inside this project folder. Is it still there?",
  noPython: "I couldn't find Python on this computer. Want to install it?",
  getPython: "Get Python",
  offer:
    "This looks like a Python project. Want me to set up a virtual environment? It keeps this project's packages in their own box.",
  offerYes: "Set it up",
  creating: "Setting up a virtual environment in .venv...",
  createFailed: "Hmm, setting up .venv didn't work. The terminal shows what happened.",
  // Ubuntu and Debian (and WSL) ship Python without venv support.
  createFailedLinux:
    "Hmm, setting up .venv didn't work. On Ubuntu or Debian, that usually means the python3-venv package is missing. The terminal shows what happened.",
  installYes: "Install",
  installing: "Installing the packages from requirements.txt...",
  installFailed:
    "Some packages didn't install. The terminal shows what happened. No internet, or a network that blocks downloads, is a common reason.",
  installStopped: "Okay, I stopped installing. Anything that finished is still there.",
  gitignore: "This project uses git. Want me to add .venv to .gitignore, so it stays out of your commits?",
  gitignoreYes: "Add it",
  gitignoreFailed: "I couldn't change .gitignore. You can add .venv/ to it yourself.",

  otherTool: (tool: string, file: string) =>
    `This project uses ${tool} (I spotted ${file}), so I'll let ${tool} handle its environment.`,
  hasEnvironment: (folder: string) => `This project already has a virtual environment (${folder}). You're all set!`,
  installQuestion: (count: number) =>
    count === 1
      ? "This project lists 1 package in requirements.txt. Install it too?"
      : `This project lists ${count} packages in requirements.txt. Install them too?`,
  // `command` is the one for her system, like "python3 -m venv .venv".
  done: (command: string) =>
    `Your Python project is all set up in .venv! Next time you can do this yourself with ${command}`,
};
