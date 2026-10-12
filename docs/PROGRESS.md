# Progress

Where Mochi stands, as of 2026-10-11. Jira (space MOCHI) is the source of
truth for task status; this doc is the readable summary, plus Arjun's likes
and dislikes. "Current state" is updated at the end of every task, as part
of that task's last commit. The rest is updated at the end of each working
session.

## Current state
*As of the last commit of the latest task, so the pull request carrying this
update isn't listed.*

- **Released:** Mochi Companion 0.1.0, a Preview, on the VS Code
  Marketplace since 2026-10-11 01:58 UTC:
  https://marketplace.visualstudio.com/items?itemName=arjungyawali.mochi-companion
- **Open pull requests:** none besides this one.
- **In progress:** MOCHI-17 Art and moods: the preview uses the icon font's
  cats; illustrated art comes when Arjun has it.
- **Next:** MOCHI-60 Windows and macOS in CI, then MOCHI-36 Celebrating,
  then Milestone 5 (see Next below).
- **Waiting on:** Arjun to approve the MOCHI-60 plan.

**46 of 59 Jira tasks and subtasks done**. 3 of the 8
categories are complete. 435 tests (397 unit, 38 integration) run on every
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
- Mochi's panel, with VS Code's theme only: the cat's mood, today's greeting
  (one line a day; a notification only when the panel isn't visible), the
  welcome on her first day, quick buttons named like their commands, and an
  "Ask Mochi anything" box using today's Ask flow. A strict content
  security policy, one stylesheet with theme variables only (checked by a
  test), and no new dependency. Typed text that looks like a password or
  API key is asked about first. "Dim things"
  is now "Switch to a dark theme" (MOCHI-16).
- The preview look: cream, lavender, and plum in light themes, deep plum
  and lilac in dark ones, nothing of its own in high contrast, every text
  pair at WCAG AA or better; the icon font's cat at 56px following the
  mood, and a vintage serif for the greeting (MOCHI-50).

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
- The first-run welcome, small version: Mochi's tab opens once, and one
  note says hello (with the pack's name for the cat), where Mochi lives,
  and which brain it would use, or how to set up Copilot with a button.
  Once ever, never with that day's greeting, and "Got a brain! Ask me
  anything." once Copilot is ready (MOCHI-42).

**Actions (MOCHI-26), complete.**
- Mochi confirms before doing anything she didn't directly ask for, with Undo
  afterwards (MOCHI-31).
- "Switch to a dark theme" (was "Dim things"): switches all of VS Code to
  Dark Modern, never touches high contrast themes (MOCHI-27).
- Focus timer: "Focusing · 18 min left" in the mood line, saved across
  reloads, "Another round" or "Done" when time's up (MOCHI-29).
- Explaining an error or selected code, on the learning ladder: explain
  first, then a hint or the fix only if she asks. From the lightbulb next to
  an error or "Mochi: Explain this" on a right-click. Shares only the error
  plus 3 lines each side, never `.env` or key files, and warns about text
  that looks like a password. Answers show in the chat in Mochi's panel,
  without taking focus (MOCHI-30, MOCHI-21).
- Setting up a Python project: "Mochi: Set up a Python project" creates
  `.venv` in the terminal panel, then asks before installing
  `requirements.txt` or adding `.venv` to `.gitignore`, and ends with the
  command to do it herself next time, plus Undo. Mochi also offers once per
  project on its own, including when she saves her first Python file in an
  empty folder, and steps aside when the Python extension will ask. Never
  in Restricted Mode or during focus, and projects using conda, Pipenv,
  Poetry, or uv are left alone. Works in remote setups (SSH, WSL,
  containers) and asks which folder in multi-root workspaces (MOCHI-28).

**Release (MOCHI-44), partly done.**
- The code is MIT; the name "Mochi Companion", the icons, and the art are
  all rights reserved (MOCHI-59). A short README for the listing (MOCHI-46,
  screenshots still to come).
- Mochi Companion 0.1.0, published to the VS Code Marketplace as a Preview
  on 2026-10-11, with a plum-on-cream store icon and banner, the default
  pack only, and nothing personal. Tested as the installed .vsix in clean
  profiles on VS Code 1.125 and 1.141. Published by uploading it on the
  Marketplace's manage page, which needs no token (MOCHI-68).

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
  (preview)" command, retired by the chat (MOCHI-22). **Mochi gave its first real answer on
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
- Keep going: a Claude answer that reaches the 4,000-token limit keeps what
  was written and offers "Keep going", which continues the same answer.
  Claude-key brains only, since VS Code's language model API doesn't say
  why a Copilot answer ended (MOCHI-67).
- The chat in Mochi's panel, part 1: her messages and Mochi's answers in
  bubbles, with the little cat; answers formatted from a small safe subset,
  built from text nodes and never as HTML (tested with hostile answers);
  https links that always show their domain; code blocks with Copy; next
  steps and problems as chips. It replaced the output panel and "Mochi:
  Ask (preview)" (MOCHI-21, part 1).
- The chat's memory, part 2: each project's chat kept in its own file,
  written atomically, up to 200 messages for her 20 most recent projects,
  and back when she opens the project again. A damaged file means an empty
  chat; a chat that can't be saved says so once. The recent messages go
  along with each question, within about 3,000 words. Attached code is sent
  once, and her message shows what was shared. The brain at the top of the
  chat, the attachment chip with its x, and "Clear chat" in the tab's ...
  menu. Forget everything reaches chats on remote machines the next time
  Mochi opens them there (MOCHI-21, part 2).
- Streaming polish: one answer at a time, a stop square in the box and
  Escape to stop, "Stopped" kept with the answer, paw prints while Mochi
  thinks (still with Reduce Motion), and each finished message announced
  once to screen readers, with code blocks named. The "Mochi is
  thinking..." notification is gone (MOCHI-25).
- Learning mode, on by default: the learning ladder for coursework-style
  requests, or direct answers with fixes when she turns it off. Only she can
  change it; a project's settings can't. "Explain with Mochi" follows it
  (MOCHI-64).

## In progress
- **MOCHI-17 Create the companion's art and moods:** the preview uses the
  icon font's cats; illustrated art comes after the preview.

## Next
The order after the preview (agreed 2026-10-11, also in BUILD_PLAN.md).
Only tasks already planned; new feature ideas come after.
1. **MOCHI-60 Windows and macOS in CI.** Overdue: the plan said before any
   release, and the preview is public.
2. **MOCHI-36 Celebrating when she finishes something**, the last of
   Milestone 4.
3. **Milestone 5:** MOCHI-43 "Make it yours" page, MOCHI-55 Make a gift
   file, MOCHI-56 Unwrap a gift file, then MOCHI-45, her gift on her
   install.
4. **Toward 1.0:** MOCHI-46 screenshots, MOCHI-61 "Mochi: Report a
   problem", MOCHI-62 decide on web support, then MOCHI-48, 1.0 without
   the Preview flag.

Alongside or later:
- **MOCHI-17 Illustrated art**, whenever Arjun has it.
- **MOCHI-54 OpenAI-compatible services and local model servers** (Ollama,
  LM Studio), a stretch goal.
- **MOCHI-69 Files she names**, a discussion first, and the feature ideas
  from 2026-10-11.
- **MOCHI-63 Localization**, later.

## Loose ends to remember
- Not checked by hand yet: whether a change to her personal layer in one
  window shows up in another window that's already open (it does after a
  restart). It needs two development windows on the normal profile.
- The development-only "Mochi dev" tools (a beaker in the development
  window's status bar) load a whole personal layer from a JSON file and
  greet on demand. Remove
  or replace them when "Make it yours" (MOCHI-43) or gifts (MOCHI-56) land.
- "Set one up" opens VS Code's Copilot setup, or Choose a brain in editors
  without it, and "Got a brain!" follows once Copilot is ready. A fuller
  "Pick a brain" inside Mochi's tab may come after the small welcome.
- Not checked yet: whether VS Code reopens on the last selected tab in the
  secondary side bar (PRESENCE.md). Worth a look while testing the panel.
- Claude answers are capped at 4,000 tokens (no extended thinking), and
  models that always think (Opus 5.5, Fable 5.1) count their thinking toward
  it. "Keep going" picks up an answer that reached it (MOCHI-67).
- If a later VS Code version tells extensions why an answer ended, "Keep
  going" can cover Copilot brains too.
- Before each release, check `claude-haiku-4-5` is still the cheapest
  current Claude model that explains well (`STARTING_POINT`), and that the
  Console links still work.
- Running VS Code from Claude Code's terminal needs `env -u
  ELECTRON_RUN_AS_NODE`, and a short `--user-data-dir` path (macOS limits
  socket paths). The clean-profile .vsix check uses both.
- PRESENCE.md and ARCHITECTURE.md still quote the old code hint ("Want me
  to explain this error?"); it's "Need a paw?" now.
- In remote setups, chats live on the remote machine, next to her project,
  since Mochi's storage folder is where Mochi runs, and the chat names that
  machine. A rebuilt dev container starts with an empty chat. Not checked
  by hand over SSH yet.
- Not checked by hand yet: the announcements with VoiceOver or NVDA, and
  the paw prints with VS Code's Reduce Motion on (MOCHI-25).
- Not checked by hand yet: a chat in one window when "Forget everything"
  runs in another (unit tested; the window clears when she comes back to
  it).
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
- Publishing: upload the tested .vsix on the Marketplace's manage page,
  which needs no token. Azure DevOps "All accessible organizations" tokens,
  which `vsce publish` needs, stop working on 2026-12-01; set up Microsoft
  Entra (`vsce publish --azure-credential`) or GitHub trusted publishing
  before then if updates should publish from the command line or CI.
- CI is Linux only, and the preview is public. Windows and macOS come next
  (MOCHI-60).
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
- **Jira and branches handled automatically:** In Progress with the branch,
  the PR link as a comment, then Done with the merge commit (see
  CLAUDE.md).
- **Keeping merged branches**, locally and on GitHub, to follow the history
  in GitKraken (since 2026-10-10).
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
- **Paying for macOS CI minutes** while the repo was private. It's public
  now.
- **Personal names and paths** in the public repo or screenshots.
- **Em dashes** in any text.

## Standing decisions worth repeating
- Keep C2PA metadata on design files, and describe how assets were made
  accurately (see DESIGN.md, Icons).
- Mochi never ships its own AI key; each user brings their own brain.
- The visual identity is designed separately. The panel is built first with
  VS Code's theme only, and its look is added later (changed 2026-10-09).
