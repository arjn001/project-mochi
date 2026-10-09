# Progress

Where Mochi stands, as of 2026-10-09. Jira (space MOCHI) is the source of
truth for task status; this doc is the readable summary, plus Arjun's likes
and dislikes. "Current state" is updated at the end of every task, as part
of that task's last commit. The rest is updated at the end of each working
session.

## Current state
*As of the last commit of the latest task, so the pull request carrying this
update isn't listed.*

- **Open pull requests:** none.
- **In progress:**
  - MOCHI-53 Connect Claude: Part 2 (her own Claude key, with the official
    Claude SDK) is built and in review.
  - MOCHI-50 Design the visual identity, by Arjun.
- **Next:** Arjun orders the work that doesn't need the panel (see "Next").
- **Waiting on:**
  - Arjun to test Part 2 with his test Claude key (its own Console
    workspace with a spend limit), pasted only into Mochi's hidden input
    box, then merge it.
  - The panel work (MOCHI-16, MOCHI-17, MOCHI-21, MOCHI-25) waits on
    DESIGN.md being finished (MOCHI-50).

**36 of 56 Jira tasks and subtasks done**. 2 of the 8
categories are complete. 311 tests (279 unit, 32 integration) run on every
pull request.

## Done
**Vision and design (MOCHI-2), complete.** VISION.md, DECISIONS.md,
MOMENTS.md, PRESENCE.md, ARCHITECTURE.md, and BUILD_PLAN.md.

**Extension foundation (MOCHI-9), complete. Milestone 1 is done.**
- Name and ID checked free: "Mochi Companion", `arjungyawali.mochi-companion`
  (MOCHI-52). Publisher `arjungyawali` created on the Marketplace (MOCHI-47),
  and the namespace claimed on Open VSX (MOCHI-57).
- Hand-made scaffold (MOCHI-10), Run Mochi and clean-profile launch options
  (MOCHI-11), unit and integration tests (MOCHI-13), CI on every pull request
  with a required check on `main` (MOCHI-51), Mochi's tab in the secondary
  side bar (MOCHI-12), and an installable `.vsix` checked in CI (MOCHI-14).

**Companion presence (MOCHI-15), partly done.**
- Status bar mood line with the Pillow Loaf icon font (MOCHI-18, MOCHI-58).
- Speak-up setting and the gatekeeper (MOCHI-19).

**Moments (MOCHI-32), partly done.**
- Quiet mode, live, with napping in the status bar (MOCHI-37).
- The greeting when VS Code opens, once a day across her windows: the time
  of day, her name if set, a warm welcome back after 2+ days away (never
  counting them), and "Back to homework-3?" when she reopens her last
  project. A fading notification until the panel exists (MOCHI-33).
- Late-night nudge, once per night across windows while she's typing, after
  the Late Hour setting. A light theme gets the dim offer; dark and high
  contrast themes get company only. Never during a focus session (MOCHI-35).
- Warnings that crash when the code runs, like Pylance's "y" is not
  defined, count as errors for "Explain with Mochi" and "Need a paw?". The
  list lives in one place and matches by tool and code (MOCHI-66).
- Noticing when she's stuck: a plain "Need a paw?" at the end of an error's
  line after 2 minutes, while she's typing in that file. Errors only, once
  per session, known by message and nearby code, kept in memory only
  (MOCHI-34).

**Actions (MOCHI-26), partly done.**
- Mochi confirms before doing anything she didn't directly ask for, with Undo
  afterwards (MOCHI-31).
- "Dim things": switches all of VS Code to Dark Modern, never touches high
  contrast themes (MOCHI-27).
- Focus timer: "Focusing · 18 min left" in the mood line, saved across
  reloads, "Another round" or "Done" when time's up (MOCHI-29).
- Explaining an error or selected code, on the learning ladder: explain
  first, then a hint or the fix only if she asks. From the lightbulb next to
  an error or "Mochi: Explain this" on a right-click. Shares only the error
  plus 3 lines each side, never `.env` or key files, and warns about text
  that looks like a password. Answers show in the "Mochi" output panel
  without taking focus, until the panel chat exists (MOCHI-30).
- Setting up a Python project: "Mochi: Set up a Python project" creates
  `.venv` in the terminal panel, then asks before installing
  `requirements.txt` or adding `.venv` to `.gitignore`, and ends with the
  command to do it herself next time, plus Undo. Mochi also offers once per
  project on its own, including when she saves her first Python file in an
  empty folder, and steps aside when the Python extension will ask. Never
  in Restricted Mode or during focus, and projects using conda, Pipenv,
  Poetry, or uv are left alone. Works in remote setups (SSH, WSL,
  containers) and asks which folder in multi-root workspaces (MOCHI-28).

**Packs and personalization (MOCHI-38), partly done.**
- Pack format with strict checking for untrusted gifts, night-owl greetings,
  and her optional name (MOCHI-39). Default pack with the reviewed voice
  (MOCHI-40).
- Her personal layer: her name ("What should I call you?", "Forget my
  name"), her own lines, and style notes, kept on her own computer and used
  right away with no reload. A damaged layer falls back kindly and is kept.
  The voice is treated as untrusted: style notes only, quoted to the AI as
  data, with Mochi's rules from code in charge, tested with a hostile voice.
  Her name is never sent to the AI (MOCHI-41).
- "Mochi: Forget everything": after a dialog, clears her chats, her personal
  layer, and everything Mochi remembers about her days (greeting memory,
  tonight's nudge, the Python-offer list, a focus session's saved end time).
  Never her settings or a saved AI key (MOCHI-65).

**AI chat (MOCHI-20), partly done.**
- Share gate that TypeScript won't let anything skip (MOCHI-23).
- VS Code's built-in AI through Copilot, and a temporary "Mochi: Ask
  (preview)" command (MOCHI-22). **Mochi gave its first real answer on
  2026-10-05.**
- Mochi's personality from the pack, with fixed rules no pack can remove, a
  warm "let's do it together" for homework requests, and example exchanges
  that give it a real voice (MOCHI-24).
- Choosing the brain: her pick (mochi.brain), otherwise Copilot's Auto, never
  another model without her; "Mochi: Choose a brain"; a stand-in note once
  per change. Copilot's helper models and zero-limit entries are hidden.
  Mochi used to take the first Copilot model, GPT-4o mini (MOCHI-53, part 1).
- Her own Claude key: "Mochi: Add a Claude key" checks it with the free
  model listing, keeps it in VS Code's secret storage, and asks "Which
  Claude model should Mochi use?" (Haiku 4.5 marked as a good starting
  point, no prices, no silent default). The key only goes to the Claude
  API, whatever the environment says. Kind lines for every problem, with a
  button when she can fix it. "Mochi: Remove my Claude key". Answers capped
  at 4,000 tokens; a silent answer stops after 30 seconds. "Set one up"
  opens Choose a brain where there's no Copilot setup. Mochi's first
  runtime dependency, the official Claude SDK, with its license in
  THIRD_PARTY_NOTICES.md (MOCHI-53, part 2).
- Learning mode, on by default: the learning ladder for coursework-style
  requests, or direct answers with fixes when she turns it off. Only she can
  change it; a project's settings can't. "Explain with Mochi" follows it
  (MOCHI-64).

## In progress
- **MOCHI-50 Design the visual identity**, by Arjun, separately. The icons are
  done; the panel's look, colors, type, and avatar art are not (see DESIGN.md,
  "Not designed yet"). This blocks MOCHI-16 (panel), MOCHI-17 (art), and
  MOCHI-21 (chat UI in the panel).

## Next
How chat works is designed in docs/CHAT.md. Work that doesn't need the
panel, for Arjun to order:
1. **MOCHI-54 OpenAI-compatible services and local model servers** (Ollama,
   LM Studio).

Then:
5. **Before publishing (Release):** MOCHI-60 Windows and macOS in CI,
   MOCHI-61 "Mochi: Report a problem", MOCHI-62 decide on web support, and
   MOCHI-63 localization.
6. **After DESIGN.md is finished:** MOCHI-17, MOCHI-16, MOCHI-21, then
   MOCHI-25 (streaming in the chat). The early preview for her comes after
   Milestone 3, with the default pack only.

## Loose ends to remember
- Remove the temporary "Mochi: Ask (preview)" command when the panel chat
  (MOCHI-21) lands.
- Not checked by hand yet: whether a change to her personal layer in one
  window shows up in another window that's already open (it does after a
  restart). It needs two development windows on the normal profile.
- The development-only "Mochi dev" tools (a beaker in the development
  window's status bar) load a whole personal layer from a JSON file and
  greet on demand. Remove
  or replace them when "Make it yours" (MOCHI-43) or gifts (MOCHI-56) land.
- "Set one up" opens VS Code's Copilot setup, or Choose a brain in editors
  without it. MOCHI-42 replaces it with "Pick a brain" inside Mochi's tab,
  plus a "Got a brain!" confirmation.
- Claude answers are capped at 4,000 tokens, and models that always think
  (Opus 5.5, Fable 5.1) count their thinking toward it. If their answers get
  cut short in testing, revisit `MAX_ANSWER_TOKENS` in `src/ai/claude.ts`.
- Before each release, check `claude-haiku-4-5` is still the cheapest
  current Claude model that explains well (`STARTING_POINT`), and that the
  Console links still work.
- Running VS Code from Claude Code's terminal needs `env -u
  ELECTRON_RUN_AS_NODE`, and a short `--user-data-dir` path (macOS limits
  socket paths). The clean-profile .vsix check uses both.
- PRESENCE.md and ARCHITECTURE.md still quote the old code hint ("Want me
  to explain this error?"); it's "Need a paw?" now. BUILD_PLAN.md says
  MOCHI-30's answer shows in the panel; it's the output panel for now.
- Mochi now runs in Restricted Mode, in a limited way (MOCHI-28). Anything
  new that runs a program in her folder must check workspace trust first.
- Every new sentence goes in `src/strings.ts` or the pack. Older sentences
  still inline in code (focus, explaining, asking, late night) move there in
  MOCHI-63.
- Plans follow the checklist in CLAUDE.md (her journeys, changes over time,
  other systems and setups, failures, a fresh-user test).
- Mochi is bundled with esbuild into `dist/extension.js`, the only code in
  the .vsix (MOCHI-14). Files read at runtime are found from Mochi's install
  folder, never relative to the code.
- No license yet (MOCHI-59). Leaning: MIT for code, Mochi's name, icons, and
  art all rights reserved. Packaging uses `--skip-license` until then.
- CI is Linux only. Add a macOS job before any release, including the private
  build for her.
- To test the late-night nudge before 23:00, set Late Hour to the current hour
  in the clean profile and type in a file. A normal profile remembers "already
  nudged tonight" until the next night.
- GitHub's `ubuntu-latest` moves to Ubuntu 26 from 2026-10-19. Pin
  `ubuntu-24.04` if CI breaks.
- The npm `overrides` entry for Mocha can go once `@vscode/test-cli` ships
  Mocha 12 itself.

## What Arjun likes
- **How we work:** explain first, small steps Arjun can run and understand, and
  being told what just happened and why.
- **Moving faster now:** several tasks in a row is fine, asking questions
  along the way. Once he approves a task's plan, all its commits get done
  without stopping, except for new decisions, his manual tests, and the
  pull request.
- The **Jira layout** after the reshuffle: one "User Stories" epic per
  category, with Tasks under it.
- A **greeting that mentions her day** (time of day, time since she last
  coded, what she was working on).
- **Mochi's cat voice:** "Meow, you look awesome and energetic today!", cat
  facts, a slow blink.
- **Late-night company:** "Late-night coding buddy, reporting for duty."
- **Answers with real personality:** "Meow, great question! A list is like a
  cozy collection...", ending with a small next step and one paw.
- **A warm redirect on homework:** "I can't do the whole assignment for you,
  but I'd love to help you with it! Let's break it down together."
- **Napping in quiet mode**, so she can see Mochi is being quiet.
- **Mochi doing things for her:** dimming the theme with a yes, and Undo.
- **Precise rules written down**, like "Mochi confirms before doing anything
  she didn't directly ask for".
- The **clean-profile launch option** ("it slays").
- The **Pillow Loaf icons** across light, dark, and high contrast themes.
- Seeing **renders, diffs, and `git status`** before commits on design work.

## What Arjun doesn't like, or asked to avoid
- **Any Claude attribution** in commits or pull requests ("Generated with
  Claude Code", Co-Authored-By lines).
- **Deleting branches** after merging. Keep every branch.
- **Shortcut-only steps** (F5 doesn't work on Arjun's keyboard). Name the menu
  path first, the shortcut in brackets, and where things are on screen.
- **Lecturing** at night (water, sleep). Mochi is a buddy, not a parent.
- **Textbook answers** with no personality, and **cold refusals** like "Sorry,
  I can't assist with that."
- **"Good night"** as a greeting; it sounds like goodbye.
- **Anime references in the default pack.** They belong in the personal
  layer.
- **Blurry icon cut-outs at 1x.** Fixed by snapping faces to the pixel grid.
- **Dead ends:** "Set one up" leading nowhere, with no confirmation.
- **Reordering the build plan** without need.
- **Paying for macOS CI minutes** while the repo is private.
- **Personal names and paths** in the public repo or screenshots.
- **Em dashes** in any text.

## Standing decisions worth repeating
- Keep C2PA metadata on design files, and describe how assets were made
  accurately (see DESIGN.md, Icons).
- Mochi never ships its own AI key; each user brings their own brain.
- The visual identity is designed separately, and no panel UI is built before
  it.
