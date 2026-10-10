// Every sentence Mochi shows lives here or in the pack, never inline in code
// (see DECISIONS.md), so it can be reviewed in one place and translated
// later (MOCHI-63). Plain code with no VS Code dependency.
//
// Sentences written before this rule still live in their own files; they
// move here as part of MOCHI-63.

// Choosing a brain (MOCHI-53).
export const brainStrings = {
  title: "Which brain should Mochi think with?",
  usesCopilotPlan: "Uses your Copilot plan",
  // Next to each of her Claude models (MOCHI-53, part 2).
  billedPerUse: "your key · billed per use",
  letMochiChoose: "Let Mochi choose",
  now: (label: string) => `Now: ${label}`,
  nowAsks: "Now: asks you first",
  signIn: "Sign in to GitHub Copilot",
  picked: (label: string) => `Got it. I'll think with ${label} from now on.`,
  pickedAuto: "Got it. I'll choose for you.",
  // When she closes the list without picking: Mochi doesn't think at all.
  waiting: "I'll think once you pick a brain. Mochi: Choose a brain whenever you're ready.",
  // At the top of her next answer, once per change.
  fallback: (missing: string, used: string) =>
    `Quick note: ${missing} isn't available right now, so I'm thinking with ${used} instead. Mochi: Choose a brain changes this.`,
};

// Mochi's panel (MOCHI-16). Each button uses the same name as the command
// it runs, so she learns one name.
export const panelStrings = {
  explain: "Explain this",
  explainHint: "Select some code, or click on an error, and I'll explain it.",
  startFocus: "Start a focus session",
  stopFocus: "Stop the focus session",
  dark: "Switch to a dark theme",
  // The box's placeholder and its label for screen readers. `companion` is
  // the pack's name for the cat.
  ask: (companion: string) => `Ask ${companion} anything`,
  send: "Send",
};

// The chat in Mochi's panel (MOCHI-21).
export const chatStrings = {
  // What her side of the chat says when she clicks Explain.
  explainError: (line: number, file: string) => `Explain the error on line ${line} of ${file}`,
  explainSelection: (file: string) => `Explain the selected code from ${file}`,
  // When the chat is empty.
  empty: "Our chat stays on this computer. It can include code from our conversation; Clear chat removes it.",
  // Who said it, for screen readers. Mochi's side uses the pack's name.
  you: "You",
  // Under her message, when something was shared with it. Kept with the
  // chat, without the code.
  shared: (what: string) => `shared ${what}`,
  copy: "Copy",
  copied: "Copied",
  // Once per session, if the chat can't be saved, like on a full disk.
  couldntSave: "I couldn't save our chat on this computer, so it lasts until VS Code closes.",
};

// The share gate. Older lines still live in ai/askToShare.ts and
// ai/secrets.ts until MOCHI-63.
export const shareStrings = {
  // After "Careful: this looks like it might contain a password or API key.
  // Send anyway?" about what she typed.
  sendAnyway: "Send anyway",
};

// The first-run welcome (MOCHI-42). `companion` is the pack's name for the
// cat. "the Mochi tab" is the tab's own label, which packs can't change.
export const welcomeStrings = {
  hello: (companion: string) => `Meow, hi! I'm ${companion}, your coding buddy.`,
  where: "I live in the Mochi tab, and my mood shows in the status bar.",
  ready: (brain: string) => `I can think with ${brain} whenever you ask me something.`,
  copilot: "To answer questions I need a brain, and GitHub Copilot's free plan works: just sign in with GitHub.",
  choose: "To answer questions I need a brain. Choose a brain shows what you can use.",
  setUpCopilot: "Set up Copilot",
  chooseBrain: "Choose a brain",
  // Once Copilot is ready after she started its setup from Mochi.
  gotABrain: "Got a brain! Ask me anything.",
};

// Her own Claude key: "Mochi: Add a Claude key" and "Mochi: Remove my Claude
// key" (MOCHI-53, part 2).
export const claudeKeyStrings = {
  title: "Add a Claude key",
  intro:
    "Mochi can think with Claude using your own API key from the Claude Console. Each answer is billed to your Claude account, per use. A Claude Pro or Max subscription can't be used here; it only works in Claude's own apps.",
  tip: "Tip: you can set a monthly spend limit in the Claude Console.",
  replaces: "This replaces the Claude key Mochi has now.",
  getKey: "Get a key",
  haveKey: "I have a key",
  prompt: "Paste your Claude API key. Mochi keeps it in your system's keychain, never in settings or files.",
  placeholder: "sk-ant-...",
  empty: "Paste your key, or press Escape to stop.",
  space: "That has a space in it. Could you paste it again?",
  checking: "Checking your key with Claude...",
  rejected: "That key didn't work. Check that you copied all of it, or make a new one in the Claude Console.",
  cantReach: "I couldn't reach Claude to check your key. Are we offline? Your key isn't saved yet.",
  cantCheck: "Claude couldn't check your key just now. Want to try again in a moment?",
  tryAgain: "Try again",
  noKeychain: "I couldn't save your key, because this computer doesn't have a keychain Mochi can use. Your key isn't kept.",
  howToFix: "How to fix this",
  noModels:
    "Your Claude key is saved, but Claude didn't list any models for it yet. Mochi: Choose a brain whenever you're ready.",
  // "Which Claude model should Mochi use?", once the key checks out.
  modelTitle: "Which Claude model should Mochi use?",
  modelPlaceholder: "Each answer is billed to your Claude account.",
  startingPoint: "Good starting point for explanations",
  savedNoPick: "Your Claude key is saved. Mochi: Choose a brain picks a Claude model whenever you're ready.",
  // "Mochi: Remove my Claude key".
  removeQuestion: "Remove your Claude key?",
  removeDetail: "Mochi forgets it on this computer. The key still works until you delete it in the Claude Console.",
  remove: "Remove",
  keep: "Keep it",
  removed: "Done. Mochi doesn't have your Claude key anymore.",
  nothingToRemove: "There's no Claude key saved, so there's nothing to remove.",
};

// When a brain can't answer, beyond the lines in ai/provider.ts. Mostly for
// her own Claude key (MOCHI-53, part 2).
export const problemStrings = {
  keyRejected:
    "Claude didn't accept your key. It may have been deleted in the Claude Console. Mochi: Add a Claude key sets a new one.",
  billing: "Your Claude account may be out of credit. You can check in the Claude Console.",
  busy: "Claude is extra busy right now. Want to try again in a moment?",
  gone: "That Claude model isn't available anymore. Ask again and I'll help you pick another.",
  tooLong: "That's a bit too much for me to send at once. Could you share a smaller piece?",
  offline: "I can't reach the brain right now. Are we offline? Everything else still works, and I'll be here when you're back.",
  declined: "This brain chose not to answer that one. Want to ask it a different way?",
  // An answer that reached the length limit (MOCHI-67).
  cutOff: "That got long, so I stopped here. Want me to keep going?",
  // Buttons.
  addClaudeKey: "Add a Claude key",
  openConsole: "Open the Claude Console",
  keepGoing: "Keep going",
};

// "Mochi: Forget everything" (MOCHI-65).
export const forgetStrings = {
  question: "Forget everything?",
  detail:
    "This clears your chats, your name and personal touches, and everything Mochi remembers about your days. Your settings and any saved AI key stay as they are.",
  yes: "Forget everything",
  keep: "Keep it",
  done: "All clear. It's a fresh start, and I'm still right here.",
  partly: "I couldn't forget everything just now. Want to try again?",
  tryAgain: "Try again",
};

// Her personal layer: her name and her own touches.
export const personalStrings = {
  unreadable:
    "I couldn't load your personal touches, so I'm my usual self for now. They're kept safe, not deleted.",
  askName: "What should I call you?",
  askNamePlaceholder: "Your name or a nickname",
  nameEmpty: "Type a name, or press Escape to keep things as they are.",
  nameTooLong: (max: number) => `That's a little long. Up to ${max} characters, please.`,
  nameOneLine: "Just one line, please.",
  nameHidden: "That has hidden characters in it. Could you type it again?",
  // `name` is shown as plain text, exactly as she typed it.
  niceToMeet: (name: string) => `Nice to meet you, ${name}! I'll use your name when I say hello.`,
  forgotName: "Okay, I've forgotten your name. You can tell me again anytime.",
  noNameYet: "I don't know your name yet, so there's nothing to forget.",
};

// Why a pack, personal layer, or gift was rejected.
export const packStrings = {
  noPersonality:
    'A personal layer can\'t replace Mochi\'s personality. Use "voice.style" for tone and style notes instead.',
  textDirection: (where: string) => `${where} contains invisible characters that change the direction of the text.`,
};

export const pythonStrings = {
  noFolder: "Open your project folder first, and I'll set it up.",
  openFolder: "Open Folder",
  untrusted:
    "This folder is in Restricted Mode, so I won't run anything in it. If you trust it, you can change that, and then I'd love to help.",
  manageTrust: "Manage Workspace Trust",
  cantRead: "I couldn't look inside this project folder. Is it still there?",
  pickFolder: "Which project should I set up?",
  workingHere: "where you're working now",
  noPython: "I couldn't find Python on this computer. Want to install it?",
  getPython: "Get Python",
  // Mochi runs on the machine with her files, so in a remote setup Python
  // has to be installed there, not on her own computer.
  noPythonRemote: (where: string, linux: boolean) =>
    `I couldn't find Python in this ${where}. It needs to be installed there, not on your own computer.` +
    (linux ? " On Ubuntu or Debian, that's: sudo apt install python3 python3-venv" : ""),
  noTrash: "I can't move .venv to the Trash here. Delete it for good?",
  deleteIt: "Delete it",
  keepIt: "Keep it",
  // On Windows, a terminal still using .venv keeps it locked.
  undoFailed: "I couldn't remove .venv. If a terminal is using it, close that terminal and delete the folder yourself.",
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
