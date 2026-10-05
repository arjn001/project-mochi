# Presence

Where Mochi lives in VS Code. The first sketch is in
[design/presence-sketch.html](design/presence-sketch.html).

Mochi shows up in four places, from always visible to only when it helps.

## 1. Side panel: its home
- A panel in the secondary side bar on the right, next to the code, as a
  "Mochi" tab beside Chat. See "Living on the right side" below.
- At the top: Mochi's avatar and a greeting about her day
  ("Good evening! What are we making?").
- In the middle: the chat with Mochi.
- Quick buttons for common actions, like "Explain this", "Focus 25 min", and
  "Dark mode".
- At the bottom: an "Ask Mochi anything" box.

## 2. Status bar: always there
- A small line in the status bar with Mochi's mood, like "Mochi is purring".
- Visible even when the panel is closed. Clicking it opens the panel.

## 3. Inside the code
- A small paw hint next to an error, like "Want me to explain this error?"
- Only appears near errors, never on working code.
- One click to explain. Nothing is shared until she clicks.

## 4. Gentle nudge
- A small card in the corner for moments that matter, like "It's past
  midnight. Want me to switch to a darker theme?"
- Rare by design: it follows the moments in MOMENTS.md and never repeats.

## Living on the right side
Checked in MOCHI-12.

![Mochi's tab beside Chat and Claude Code in the secondary side bar](design/screenshots/mochi-beside-chat.png)

- **Mochi can live on the right directly.** Extensions can put their view in
  the secondary side bar (`viewsContainers.secondarySidebar` in
  package.json). VS Code 1.125, our oldest supported version, supports this,
  so nobody has to drag Mochi there.
- **Mochi is a tab beside Chat.** Tested on VS Code 1.140 with Copilot Chat
  and Claude Code installed, the tabs read left to right: Chat, Claude Code,
  Mochi. Built-in Chat comes first and Mochi comes after it.
- **Tabs show as text labels by default**, so the cat icon isn't visible in
  that row. It appears only if she switches the bar to icons
  (`workbench.secondarySideBar.showLabels`).
- **The right side bar may start closed.** In testing it was closed at first
  and showed after View > Appearance > Secondary Side Bar. Clicking the Mochi
  tab shows Mochi.

What this means for later:
- Mochi can't count on being the open tab. The first-run welcome (MOCHI-42)
  should open Mochi's tab once, and clicking the status bar mood (MOCHI-18)
  should open it too. Both use VS Code's `workbench.view.extension.mochi`
  command.
- The cat icon in the left activity bar from the first sketch isn't part of
  this layout. The "Mochi" tab on the right takes its place.
- Whether VS Code reopens on the last selected tab is worth checking in
  MOCHI-16.

## Speak-up levels
- **Quiet:** only the status bar mood. No hints in the code, no nudges.
- **Gentle (default):** all four places, used sparingly.
- **Chatty:** all four places, with more greetings and small talk.
- **In quiet mode, napping always wins over any other mood.** The mood line
  shows "Mochi is napping" with the tooltip "Quiet mode. Click to open
  Mochi.", so she can see at a glance that Mochi is being quiet.
- Changing the level takes effect right away, with no reload. A project can
  have its own level, which wins over her user setting.

## Look
A soft illustrated cat with a few moods, in original art.
