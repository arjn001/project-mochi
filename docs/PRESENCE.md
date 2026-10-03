# Presence

Where Mochi lives in VS Code. The first sketch is in
[design/presence-sketch.html](design/presence-sketch.html).

Mochi shows up in four places, from always visible to only when it helps.

## 1. Side panel: its home
- A panel on the right side, next to the code, opened from a cat icon in the
  activity bar.
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

## Speak-up levels
- **Quiet:** only the status bar mood. No hints in the code, no nudges.
- **Gentle (default):** all four places, used sparingly.
- **Chatty:** all four places, with more greetings and small talk.

## Look
A soft illustrated cat with a few moods, in original art.
