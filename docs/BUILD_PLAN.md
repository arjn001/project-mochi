# Build Plan

The order we build Mochi in. Each slice is one Jira task, small enough to run
and understand in one sitting. Each milestone ends with something real to use.

## How every slice works
- One branch per slice, merged with a pull request.
- Tests pass on the pull request before it's merged.
- Each slice says what you'll see when it works. If you can't see it, it isn't
  done.

## In parallel: the visual identity
**MOCHI-50 Design the visual identity** is done separately and lands in
DESIGN.md. It no longer blocks the panel (changed 2026-10-09): MOCHI-16 is
built first with VS Code's theme only, with its styles in one place and
theme variables only, so the look can be added later without rewriting it.

## Order to the early preview (from 2026-10-09)
1. **MOCHI-42 First-run welcome**, small version: one greeting, where Mochi
   lives, and a brain check.
2. **MOCHI-67 Keep going after a long answer.**
3. **MOCHI-16 Build the side panel**, with VS Code theme styling only.
4. **MOCHI-21 Build the chat interface.**
5. **MOCHI-25 Stream replies as they're written**, in the panel.
6. **MOCHI-17 Create the companion's art and moods**, and the panel's look,
   once MOCHI-50 is done.
7. **MOCHI-68 Early preview build for her.**

MOCHI-60 (Windows and macOS in CI) comes before the public release, not
before the preview.

## Milestone 1: Mochi exists
1. **MOCHI-52 Check the name and ID are free on the Marketplace.** You'll see:
   the name and ID we'll use, confirmed available.
2. **MOCHI-47 Publisher account.** Create the `arjungyawali` publisher. You'll
   see: the publisher page on the Marketplace, ready for package.json.
3. **MOCHI-10 Scaffold the extension project.** package.json uses publisher
   `arjungyawali`, name `mochi-companion`, and display name "Mochi
   Companion". You'll see: a "Hello from Mochi" command.
4. **MOCHI-11 Run it in the development window.** You'll see: press F5 and the
   command works in a second VS Code window.
5. **MOCHI-13 Set up building and tests.** You'll see: one passing unit test
   and one passing integration test.
6. **MOCHI-51 Run tests on every pull request.** Linux only for now, since
   the repo is private and macOS CI minutes cost several times more. You'll
   see: GitHub Actions running the tests on a pull request, with a green
   check.
7. **MOCHI-12 Add the companion's icon to the sidebar.** You'll see: a cat icon
   that opens an empty view. We also check whether the panel can open on the
   right side.
8. **MOCHI-18 Add the status bar mood line.** You'll see: "Mochi is purring" in
   the status bar.
9. **MOCHI-14 Package an installable file.** You'll see: a `.vsix` file that
   installs on your own VS Code.

## Milestone 2: Mochi has a home
10. **MOCHI-19 Add the speak-up setting** and **MOCHI-37 Respecting quiet
    mode.** You'll see: quiet, gentle, and chatty in settings, and the
    gatekeeper's unit tests passing.
11. **MOCHI-17 Create the companion's art and moods**, following DESIGN.md.
    You'll see: the cat's moods as image files in the default pack.
12. **MOCHI-16 Build the side panel.** Needs DESIGN.md merged. You'll see: the
    panel with Mochi's avatar and a greeting, in light, dark, and high contrast
    themes.

## Milestone 3: Mochi talks
13. **MOCHI-39 Define the pack format** and **MOCHI-40 Build the default
    pack.** You'll see: Mochi's phrases and moods loaded from the pack.
14. **MOCHI-21 Build the chat interface.** You'll see: a chat that echoes back
    what you type.
15. **MOCHI-23 Share selected code or errors, only with permission.** The share
    gate comes before any AI. You'll see: the "Share this with...?" prompt and
    its unit tests passing.
16. **MOCHI-22 Connect the AI provider.** The provider layer plus VS Code's
    built-in AI, reachable only through the share gate. No path to an AI ever
    skips it. You'll see: a real reply from the built-in AI.
17. **MOCHI-53 Connect Claude.** You'll see: a reply from Claude using your own
    API key, kept in secret storage.
18. **MOCHI-25 Stream replies as they're written.** You'll see: replies
    appearing word by word.
19. **MOCHI-24 Give the AI its personality from the pack.** You'll see: replies
    in Mochi's voice.

**Early preview:** after Milestone 3, she gets a `.vsix` with the default pack
only. The personal layer and the gift stay a surprise for Milestone 5.

## Milestone 4: Mochi notices and helps
20. **MOCHI-31 Always confirm before acting.** You'll see: every action asking
    before it does anything.
21. **MOCHI-27 Switch the theme.** You'll see: "Switch to a darker theme?" and
    the theme changing after yes.
22. **MOCHI-29 Start a focus timer.** You'll see: a 25 minute timer in the
    status bar.
23. **MOCHI-30 Explain an error or selected code.** You'll see: an explanation
    in the panel, after the share gate.
24. **MOCHI-28 Set up a Python project.** You'll see: a virtual environment
    created after she confirms.
25. **MOCHI-33 Greeting when VS Code opens.** You'll see: a greeting about her
    day.
26. **MOCHI-34 Noticing when I'm stuck on errors**, including the code hints.
    You'll see: a paw hint after errors stay for 2 minutes, offered once.
27. **MOCHI-35 Late-night nudge**, including the corner nudges. You'll see: one
    nudge after 11 pm, never repeated that night.
28. **MOCHI-36 Celebrating when I finish something.** You'll see: a
    celebration naming what she finished.

## Milestone 5: Mochi is hers, then everyone's
**Before any release** (including MOCHI-45, the private build for her): add a
macOS job to the CI workflow from MOCHI-51, since Mochi's first users are on
Macs.

29. **MOCHI-41 Build the private personal layer.** You'll see: a personal
    layer laid over the default pack, kept in private storage.
30. **MOCHI-42 First-run welcome.** (A small version moved ahead of the
    early preview.) You'll see: a hello, the AI choice, and the
    "Got a gift file?" link.
31. **MOCHI-43 "Make it yours" page.** You'll see: every setting editable, plus
    import and export.
32. **MOCHI-55 Make a gift file.** You'll see: a `.mochigift` saved, with your
    own install unchanged.
33. **MOCHI-56 Unwrap a gift file.** Includes the safety checks from
    ARCHITECTURE.md. You'll see: the "You've got a gift!" screen, and tests
    showing malicious gift files rejected.
34. **MOCHI-45 Private build for her.** You'll see: her install, with her gift.
35. **MOCHI-46 README and screenshots.** You'll see: a Marketplace page that
    welcomes a stranger.
36. **MOCHI-48 Public build and publish.** You'll see: Mochi on the VS Code
    Marketplace.

## Stretch goals
- **MOCHI-54 Connect OpenAI-compatible services.** Covers ChatGPT. Built if
  there's time before publishing, otherwise it moves after version 1.
