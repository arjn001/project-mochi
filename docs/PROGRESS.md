# Progress

Where Mochi stands, as of 2026-10-05. Jira (space MOCHI) is the source of
truth for task status; this doc is the readable summary, plus Arjun's likes
and dislikes. Update it at the end of each working session.

**28 of 51 Jira items done** (26 tasks and 2 subtasks). 76 tests (70 unit, 6
integration) run on every pull request.

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

**Packs and personalization (MOCHI-38), partly done.**
- Pack format with strict checking for untrusted gifts, night-owl greetings,
  and her optional name (MOCHI-39). Default pack with the reviewed voice
  (MOCHI-40).

**AI chat (MOCHI-20), partly done.**
- Share gate that TypeScript won't let anything skip (MOCHI-23).
- VS Code's built-in AI through Copilot, and a temporary "Mochi: Ask
  (preview)" command (MOCHI-22). **Mochi gave its first real answer on
  2026-10-05.**
- Mochi's personality from the pack, with fixed rules no pack can remove, a
  warm "let's do it together" for homework requests, and example exchanges
  that give it a real voice (MOCHI-24).

## In progress
- **MOCHI-50 Design the visual identity**, by Arjun, separately. The icons are
  done; the panel's look, colors, type, and avatar art are not (see DESIGN.md,
  "Not designed yet"). This blocks MOCHI-16 (panel), MOCHI-17 (art), and
  MOCHI-21 (chat UI in the panel).

## Next
Arjun picks the order of these two:
1. **MOCHI-53 Connect Claude**, with her own key in secret storage. Add
   esbuild bundling here if it brings Mochi's first runtime dependency.
2. **Work that doesn't need the panel:** MOCHI-31 (always confirm before
   acting), MOCHI-27 (switch the theme), MOCHI-29 (focus timer), and the
   moments that use the status bar or nudges.

Then:
3. **After DESIGN.md is finished:** MOCHI-17, MOCHI-16, MOCHI-21, then
   MOCHI-25 (streaming in the chat). The early preview for her comes after
   Milestone 3, with the default pack only.

## Loose ends to remember
- Remove the temporary "Mochi: Ask (preview)" command when the panel chat
  (MOCHI-21) lands, and the demo "Mochi: Say Hello" command when real
  features replace it.
- "Set one up" opens VS Code's Copilot setup for now. MOCHI-42 replaces it
  with "Pick a brain" inside Mochi's tab, plus a "Got a brain!" confirmation.
- No bundling yet; add esbuild with the first runtime dependency.
- No license yet (MOCHI-59). Leaning: MIT for code, Mochi's name, icons, and
  art all rights reserved. Packaging uses `--skip-license` until then.
- CI is Linux only. Add a macOS job before any release, including the private
  build for her.
- GitHub's `ubuntu-latest` moves to Ubuntu 26 from 2026-10-19. Pin
  `ubuntu-24.04` if CI breaks.
- The npm `overrides` entry for Mocha can go once `@vscode/test-cli` ships
  Mocha 12 itself.

## What Arjun likes
- **How we work:** explain first, small steps Arjun can run and understand, and
  being told what just happened and why.
- **Moving faster now:** several tasks in a row is fine, asking questions
  along the way.
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
