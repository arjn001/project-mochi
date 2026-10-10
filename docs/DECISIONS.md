# Decisions

## Product
- Dropped the first prototype (a story-and-puzzles room in a tab). It felt like
  homework with nice wallpaper. The companion should live beside the work.
- Version 1 is a companion panel with AI chat, a few actions, and gentle
  reactions to key moments.
- Personalization works through packs: the extension is the engine, packs give
  it a personality (look, colors, voice, phrases). Version 1 ships two: a
  default pack and a private personal layer that never ships publicly.
- Settings are always editable through a "Make it yours" page.

## Where Mochi runs
- Desktop only in version 1, on purpose: VS Code on Windows, macOS, and
  Linux, including remote setups (SSH, WSL, dev containers, Codespaces),
  where Mochi runs on the machine that has her files (`extensionKind` is
  "workspace" in package.json).
- Not VS Code for the Web (vscode.dev, github.dev). Mochi has no web entry
  point, so it doesn't load there. Whether to support it is decided later
  (MOCHI-62).

## Name and ID
- Marketplace display name: "Mochi Companion". Plain "Mochi" is already taken
  by another AI coding extension.
- Publisher: `arjungyawali`, so Arjun is the author. This is also a portfolio
  project.
- Extension ID: `arjungyawali.mochi-companion`.
- Inside VS Code, the cat is still just called Mochi.
- Checked free on 2026-10-03: the display name, publisher, and ID on the VS
  Code Marketplace, and the `arjungyawali` namespace and ID on Open VSX. Mochi
  may be published on Open VSX too.

## AI
- Mochi works without AI. Greetings, late-night company, quiet mode, the mood
  line, and actions like the theme and focus timer all work with no brain.
  AI is for chat, explaining code and errors, checking her work, and
  understanding when she says she finished something.
- The first-run welcome starts small (MOCHI-42, see "The first-run
  welcome" below). A fuller "Pick a brain" step may come later, in this
  order:
  1. VS Code's built-in AI, through her Copilot sign-in, when it's available.
     No key in Mochi; it uses her Copilot plan (see "Copilot costs her
     plan" below). VS Code shows its own one-time permission prompt.
  2. "My own Claude key", stored in VS Code's secret storage.
  3. Any OpenAI-compatible service, with an API key and an address. This
     covers ChatGPT. A stretch goal that can move after version 1.
  4. "Maybe later".
- No nagging. If she skips it, the only prompt is when she asks something in
  chat: "I'd need a brain to answer that. Want to set one up?", with a button.
- The brain can be changed anytime on the "Make it yours" page.
- We never ship our own AI key inside Mochi, and Mochi has no server of its
  own. Each user brings their own brain, through Copilot or their own key.
- **Copilot costs her plan, so Mochi only thinks when she asks.** Since
  2026-06-01, Copilot bills every chat message in GitHub AI Credits, by
  tokens, at each model's API price; no chat model is free, on any plan.
  Copilot Free and Copilot Student have an allowance of credits and get
  models through Auto only; paid plans get 10% off when using Auto. Mochi
  never calls the AI on its own, so it never spends her plan without her.
  (Checked 2026-10-07: [GitHub's billing
  post](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/),
  [usage-based billing for
  individuals](https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing).)
- **Which brain (MOCHI-53):** her pick if it's there, otherwise Copilot's
  Auto. Mochi never picks another model without her: with no Auto and no
  pick, it shows "Which brain should Mochi think with?" when she asks, and
  if she closes it, it answers with one line instead of thinking. No price
  table in Mochi; prices change too often to hardcode.
- Her pick is the `mochi.brain` setting (like `copilot/auto`), user-level
  only, so a project, a pack, or a gift can't change it. Empty or malformed
  means "let Mochi choose". If her pick disappears (signed out, another
  machine), Auto stands in and a note says so once per change, at the top
  of her next answer, never as a pop-up.
- Copilot's helper models (`copilot-utility...`, `copilot-dictation...`)
  and anything with an input limit of 0 (like Copilot CLI's entry) are
  never offered. The helper list lives in one place (`src/ai/brains.ts`).
- **Her own Claude key (MOCHI-53, part 2, agreed 2026-10-07 and
  2026-10-09):**
  - Through the official Claude SDK, `@anthropic-ai/sdk` (MIT), Mochi's
    first runtime dependency, bundled into `dist/extension.js`.
  - The key only ever goes to `https://api.anthropic.com`. Nothing from the
    environment is used (a cloned project or dev container can set
    `ANTHROPIC_*` variables), and every request is checked on its way out:
    the address, her key, and a short list of allowed headers. Never
    logged, never in an error.
  - Checked with the free model listing before it's saved. A key that
    doesn't work is never saved.
  - She chooses the model: every current model the listing returns, no
    prices, no hiding by price, each marked "your key · billed per use".
    "Good starting point for explanations" marks `claude-haiku-4-5`, kept
    in one place. Retired and deprecated models aren't shown.
  - No silent default: right after the key checks out, the list is shown
    once. Closing it keeps the key; Mochi doesn't pick a Claude model for
    her.
  - When a model refuses, Mochi doesn't retry with another model, since
    that would bill a model she didn't pick.
  - Answers are capped at 4,000 tokens, with no extended thinking. Mochi
    waits 30 seconds for an answer to start, and stops one that goes silent
    for 30 seconds, keeping what was written.
  - An answer that reaches the cap offers "Keep going", which continues the
    same answer with the same approved request (MOCHI-67). Claude-key
    brains only: VS Code's language model API doesn't say why a Copilot
    answer ended.
  - Low credit can come back as a plain 400, and Mochi never matches error
    text, so the general "Something went wrong" line offers "Open the
    Claude Console" for key-based brains. Copilot's lines have no buttons.
  - "Mochi: Remove my Claude key" also clears the saved list of her Claude
    models, and her pick if it was a Claude model.
  - "Set one up" opens Choose a brain in editors without Copilot's setup,
    so it's never a dead end there.
- All options sit behind one provider layer, so Mochi's personality comes from
  the pack, not from whichever AI answers.
- API keys live in VS Code's secret storage, never in settings files or the
  repo.
- The share gate always names the AI before anything Mochi attaches is sent
  ("Share this error with Claude?").
- The welcome explains that a ChatGPT or Claude subscription is not an API
  key. API keys are billed separately per use.
- Local models no longer wait: they come through VS Code's built-in AI when
  their extension provides them (like Ollama's or AI Toolkit), and through
  the OpenAI-compatible option with a local address (MOCHI-54). How chat
  works, brain by brain, is in CHAT.md.
- Mochi prefers models already in VS Code's built-in AI (Copilot and
  extension models), with no key stored in Mochi. Keys typed into VS Code's
  own "Manage Models" screen aren't reliably available to extensions, so for
  people who only have an API key, Mochi stores it itself in secret storage
  (checked 2026-10-06, sources in CHAT.md).
- Subscriptions (ChatGPT Plus, Claude Pro/Max) can't be used in other apps;
  Anthropic's terms say so explicitly. Mochi explains this honestly and
  offers Copilot or an API key instead.
- **Mochi never calls the AI on its own.** Only her message, or her click
  (like "Explain with Mochi"), starts an AI request. Never for greetings,
  nudges, hints, or background work.
- **Nothing in an AI reply can make Mochi act.** Any action a reply suggests
  (switch to a dark theme, set up Python, future actions) needs her click,
  through the normal "asks first, then Undo" flow.
- **Learning mode**, on by default: the learning ladder for coursework-style
  requests. Off gives direct answers. Only she can change it: it's a user
  setting a project can't override (`"scope": "application"`, checked by a
  unit test), and packs and gifts can't touch settings. The always-on rules
  (only use what she shared, plain words, say so when unsure, never refuse
  coldly) apply either way. Explaining an error follows it too (MOCHI-64).

## Deferred, by design
- Messaging between people (notes, ask for help, Live Share). The architecture
  should leave room for it.
- A natural-language layer over any installed extension's commands. Version 1
  starts with a small set of hand-picked actions.
- Community packs.

## Presence
- Home on the right side, a status bar mood line when closed, gentle by
  default, a soft illustrated cat with moods.
- Two more places from the first sketch: a hint inside the code next to
  errors, and a gentle corner nudge for key moments. Both stay silent in
  quiet mode.

## What Mochi keeps on her computer
Everything stays on her computer, in Mochi's private storage, never synced
and never sent anywhere except to the brain she picked when she sends a
message.
- **Chat history:** up to 200 messages per project, for her 20 most recent
  projects. **It can include code:** code she pastes into a message and
  code the brain quotes in a reply are part of the conversation. "Clear
  chat" removes a project's history. Attached code isn't saved with it; it's
  kept only until VS Code closes.
- **Her personal layer:** her name, her lines, and style notes.
- **About her day, for the greeting:** when she last coded, the project's
  folder name, the day she was last greeted, and today's greeting line.
- **The panel's unsent draft:** what she typed in the Ask box and didn't
  send, kept by VS Code for the panel. "Forget everything" clears it, right
  away if the panel is open, otherwise the next time it opens.
- **Small reminders:** tonight's late-night nudge, which projects were
  offered Python setup, a focus session's end time.
- **Her Claude models:** the ids and names from the last Claude model
  listing that worked, so a moment offline doesn't make her pick look gone.
  Nothing secret. Cleared by "Remove my Claude key" and "Forget
  everything". Her key itself is in VS Code's secret storage, not here.
- Mochi never saves code on its own: stuck hints and the share gate keep
  nothing on disk.
- **"Mochi: Forget everything"** (MOCHI-65), after confirming in a dialog,
  clears:
  - every chat, in every project (with MOCHI-21);
  - her personal layer, including a damaged copy kept aside;
  - what Mochi remembers about her days: when and where she last coded, the
    day she was last greeted and today's greeting line, tonight's late-night
    nudge, and which projects were offered Python setup;
  - the panel's unsent draft;
  - a focus session's saved end time. A session that's running keeps going,
    since she started it, but won't come back after a restart;
  - the saved list of her Claude models (the key itself stays).
- It never touches her settings (speak-up level, Learning mode, the chosen
  brain), a saved AI key, or whether she's had the first-run welcome; the
  confirmation says so. Removing her Claude
  key is "Mochi: Remove my Claude key" (MOCHI-53).
- Chats and the Python-offer list are kept in one private store across
  projects, so Forget everything reaches all of them from any window. If
  one part can't be cleared, the rest still are, and Mochi offers to try
  again.

## Which problems count as errors
- Errors always count, for "Explain with Mochi" and "Need a paw?".
- A few warnings count too, because they always crash the program when it
  runs. Pylance marks `"y" is not defined` (a `NameError`) as a warning, yet
  it's one of the most common beginner mistakes (MOCHI-66).
- The list lives in one place (`src/problems.ts`) and matches by the tool and
  the warning's code (like Pylance's `reportUndefinedVariable`), never its
  text, so it works in any display language. It starts with undefined names
  from Pylance, Pyright, and basedpyright.
- Ordinary warnings, like an unused import, stay quiet.

## Noticing when she's stuck
- An error is "offered once" per VS Code session: Mochi remembers it in
  memory only, and saves nothing about it to disk.
- Why: private by default, and if the same error is still there a day later,
  a fresh offer is helpful, not nagging.
- An error is identified by its message plus the code on and around its line,
  never by line number, so an error that moves isn't offered again.

## Her personal layer
- Kept in Mochi's private global state, on her own computer, even in remote
  setups. Not in settings, the repo, or her project, so a project can never
  change Mochi's voice.
- Not synced through Settings Sync in version 1, to keep it on her machine.
- Her name is never sent to the AI. It's only used in Mochi's own lines. A
  later opt-in to share it may come with "Make it yours" (MOCHI-43).
- The voice is untrusted, since a gift becomes this layer: it can only add
  style notes (400 characters), framed to the AI as style, never as
  instructions, and Mochi's rules always come from code (see ARCHITECTURE.md).
- A damaged or too-new layer falls back to the default pack with one kind
  message per session, and is kept, never deleted.
- "What should I call you?" and "Forget my name" exist now, and the greeting
  (MOCHI-33) uses her name.
- A loader for trying a whole layer from a JSON file exists only when Mochi
  runs from source. It's never in the published package (checked in CI).

## The greeting
- Once a day across all her windows, like the late-night nudge. Chatty mode
  too. Never in quiet mode, or when a focus session is already running.
- A warm welcome back after 2 or more days away, never with a number:
  counting absence can feel like guilt.
- Mochi remembers when she last coded and the project's folder name (never a
  path or anything from her code), saving at most once a minute.
- Shown at the top of Mochi's panel, through the greeting surface (MOCHI-16).
  One line is picked a day and kept, so the panel shows the same line every
  time she opens it that day, in every window. A fading notification only
  when the panel isn't visible. Opening the panel shows today's line even
  in quiet mode, since she opened it; that doesn't count as the day's
  greeting.
- On her first-ever day, the first-run welcome (MOCHI-42) replaces the
  greeting; never both.
- If a Python project is opening too, the Python offer waits until after the
  greeting.

## The first-run welcome
- A small version comes before the early preview (MOCHI-42, agreed
  2026-10-09): Mochi opens its tab once, then shows one gentle notification
  with a greeting (the cat's name from the pack), where Mochi lives (the
  Mochi tab and the status bar), and a brain check.
- The brain check only looks at what's available. It never asks a brain
  anything, so it can't show Copilot's permission prompt or spend anything.
  Right after VS Code starts, Copilot may not be listed yet, so with nothing
  found it waits up to 8 seconds for VS Code's "models changed" event and
  looks once more.
- With a brain, it names the one Mochi would think with. With none, one line
  on setting up Copilot (its free plan works) and "Set up Copilot"; in
  editors without Copilot's setup, "Choose a brain" instead. With brains but
  none chosen yet, it doesn't mention one: Mochi asks when she first asks
  something.
- After any Copilot setup she starts from Mochi (the welcome or "Set one
  up"), Mochi says "Got a brain! Ask me anything." once Copilot is ready.
- Once ever, across her windows. It waits through quiet mode and focus
  sessions. Someone who used Mochi before the welcome existed is never
  welcomed as new. "Forget everything" doesn't bring it back: it's about
  installing Mochi, not about her days.
- On that day it takes the greeting's place, and the Python offer waits for
  it. It moves into the panel with MOCHI-16, through the greeting surface.

## Setting up a Python project
- Mochi creates a virtual environment in `.venv`, the standard name the
  Python extension finds on its own. The steps run as VS Code tasks in the
  terminal panel, so she sees the real commands, and success ends with the
  one she can type herself ("python3 -m venv .venv").
- From the Command Palette, creating `.venv` isn't confirmed again: she asked
  for it, and Undo moves `.venv` to the Trash.
- Installing `requirements.txt` is always asked first ("This project lists 3
  packages in requirements.txt. Install them too?"), since it downloads and
  runs code she didn't directly ask for.
- Adding `.venv` to `.gitignore` is asked first too, and only offered in a
  git repo that doesn't ignore it yet, on Python older than 3.13 (newer
  versions make `.venv` ignore itself).
- Never in Restricted Mode: in a folder she hasn't trusted, Mochi never runs
  setup or installs and never offers, and explains kindly if she asks. Mochi
  supports Restricted Mode in a limited way for this, instead of switching
  off completely there.
- Projects that use conda (`environment.yml`), Pipenv (`Pipfile`), Poetry
  (`poetry.lock`), or uv (`uv.lock`) are left to that tool. An environment is
  already there if `.venv/`, `venv/`, or `env/` has a `pyvenv.cfg`.
- Mochi offers on its own once per project, ever, only when Python is
  installed. It remembers which project folders it offered for, and nothing
  about the code in them.
- On a Mac without the developer tools, `/usr/bin/python3` is only a
  placeholder that pops up an installer, so Mochi skips it instead of acting
  without asking.
- Mochi looks again whenever she saves a `.py` file, `requirements.txt`, or
  `pyproject.toml`, so a folder that was empty when she opened it still gets
  the offer once she starts writing Python. After not finding Python, it
  waits 10 minutes before looking again.
- The offer waits while she's in a focus session.
- Mochi's automatic offer steps aside when Microsoft's Python extension will
  ask the same thing: it's installed, its `python.createEnvironment.trigger`
  setting isn't "off" (the default is "prompt"), and the project has a
  requirements file. Checked against the extension's own code (2026.6.0),
  not assumed. The command always works.
- In a remote setup, Python, git, and the terminal are the remote ones, so
  in WSL she gets Linux commands even on a Windows laptop. "No Python" names
  the machine ("in this WSL distro") instead of linking downloads for the
  wrong computer. Where there's no Trash (often on remote machines and in
  containers), Undo asks "Delete it for good?" instead of failing.
- In a multi-root workspace, the command always asks which folder, with the
  one she's working in first. Setting up the wrong folder silently would put
  `.venv` in the wrong place. The automatic offer is tracked per folder.
- Course folders (`hw1/`, `hw2/`, ...) get one `.venv` at the top. Only the
  top-level `requirements.txt` is installed, and the question names it.
- An install can be stopped with Cancel, and a failed one mentions that no
  internet or a restricted network is a common reason. On Linux, a failed
  setup mentions the usual cause, a missing python3-venv package.

## The panel
- Mochi's tab is a webview view, built first with VS Code's theme only
  (MOCHI-16); its look is added later (MOCHI-50, MOCHI-17).
- A strict content security policy: nothing is allowed unless listed, and
  the list is the stylesheet and icon font from Mochi's files and one
  script carrying a fresh nonce. No inline styles or scripts.
  `localResourceRoots` is only `media/` and `dist/webview/`.
- All styles live in one stylesheet, `media/panel/panel.css`, using only VS
  Code's `--vscode-*` variables through `--mochi-*` tokens defined in its
  first block. A unit test fails on any raw color.
- No framework and no new dependency. The Webview UI Toolkit was deprecated
  on 2025-01-01, and codicons would be a CC-BY dependency.
- Mochi holds everything the panel shows and sends it whenever the panel
  opens or something changes; the panel has no words of its own. Every
  message from the panel is checked, and anything unknown is ignored. No
  `retainContextWhenHidden`.
- Buttons use the same names as the commands they run.
- The Ask box uses the same flow as "Mochi: Ask", until the chat (MOCHI-21).
- Text she types that looks like a password or API key is asked about
  first ("Send anyway?"), in the panel and in "Mochi: Ask". It lives in the
  share gate.

## Building and packaging
- Mochi is packaged into a `.vsix` with `npm run package`.
- Mochi is bundled with esbuild (MOCHI-14, before its first runtime
  dependency, the Claude SDK in MOCHI-53). `src/extension.ts` and everything
  it uses become one file, `dist/extension.js`, which is Mochi's entry point
  and the only code in the .vsix. CI fails if any other JavaScript, `src/`,
  or `out/` ends up in the package.
- TypeScript still compiles everything to `out/` for the tests and the
  development-only tools. The bundle loads the dev tools from `out/` only in
  development mode, so they never ship.
- Files Mochi reads at runtime (like the default pack) are found from its
  install folder, not from where the code sits, since the bundle lives in
  `dist/`.
- F5 runs two watchers: TypeScript (for `out/`) and esbuild (for `dist/`).
- The panel's script is a second bundle, `dist/webview/panel.js`, built for
  the browser inside VS Code, with its own TypeScript settings
  (`src/webview/tsconfig.json`) so it gets browser types and nothing from
  Node. CI allows exactly these two files of code in the .vsix.
- Runtime dependencies are bundled too, so `npm run package` leaves
  `node_modules` out (`--no-dependencies`). Only `vscode` stays external.
- esbuild warnings fail the build.
- Third-party code in the bundle is listed with its license in
  `THIRD_PARTY_NOTICES.md`, which ships in the .vsix. `npm run notices`
  writes it from what esbuild actually put in the bundle, and the build
  fails if it doesn't match (MOCHI-53).
- No license yet. Mochi is packaged with `--skip-license` until one is chosen
  before going public (MOCHI-59). Leaning: MIT for the code, with Mochi's
  name, icons, and art all rights reserved.

## Writing
- Every sentence Mochi shows lives in one place: the pack (Mochi's voice) or
  `src/strings.ts`, never inline in code. This keeps the wording reviewable
  and ready for other languages (MOCHI-63). It started with MOCHI-28; older
  sentences move there as part of MOCHI-63.

## Process
- Jira space MOCHI: each category is a "User Stories" epic with its user
  story in the description, and Tasks under it.
- Small, natural commits, one logical change each, starting with the Jira key.
- One branch per task, merged with a pull request.
- After a merge, the Jira issue moves to Done with the merge commit in a
  comment, and the branch is deleted locally and on GitHub (since
  2026-10-09; branches used to be kept).
