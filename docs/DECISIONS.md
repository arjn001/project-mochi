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
- The first-run welcome has one optional step, "Pick a brain", in this order:
  1. VS Code's built-in AI, through her Copilot sign-in, when it's available.
     No key needed. VS Code shows its own one-time permission prompt.
  2. "My own Claude key", stored in VS Code's secret storage.
  3. Any OpenAI-compatible service, with an API key and an address. This
     covers ChatGPT. A stretch goal that can move after version 1.
  4. "Maybe later".
- No nagging. If she skips it, the only prompt is when she asks something in
  chat: "I'd need a brain to answer that. Want to set one up?", with a button.
- The brain can be changed anytime on the "Make it yours" page.
- We never ship our own AI key inside Mochi, and Mochi has no server of its
  own. Each user brings their own brain, through Copilot or their own key.
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
  (dim things, set up Python, future actions) needs her click, through the
  normal "asks first, then Undo" flow.
- **Learning mode**, on by default: the learning ladder for coursework-style
  requests. Off gives direct answers. Only she can change it: it's a user
  setting a project can't override, and packs and gifts can't touch
  settings.

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
  folder name, and the day she was last greeted.
- **Small reminders:** tonight's late-night nudge, which projects were
  offered Python setup, a focus session's end time.
- Mochi never saves code on its own: stuck hints and the share gate keep
  nothing on disk.
- **"Mochi: Forget everything"** clears every chat, what Mochi remembers
  about her days, and her personal layer, after confirming. Chats are kept
  in one private store across projects, so this reaches all of them.

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
- Shown as a fading notification until the panel exists, through a small
  greeting surface the panel will take over.
- On her first-ever day, the first-run welcome (MOCHI-42) replaces the
  greeting; never both.
- If a Python project is opening too, the Python offer waits until after the
  greeting.

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

## Building and packaging
- Mochi is packaged into a `.vsix` with `npm run package`. Source code
  (`src/`) and compiled tests (`out/test/`) never go into the package, and CI
  fails if they do.
- No bundling yet (decided in MOCHI-14). Mochi has no runtime dependencies, so
  the TypeScript compiler alone is enough. esbuild bundling gets added with
  the first runtime dependency, most likely in MOCHI-22 or MOCHI-53.
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
- Branches are kept after merging, never deleted.
