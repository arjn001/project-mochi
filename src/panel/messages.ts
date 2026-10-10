// What Mochi's panel (MOCHI-16) and the rest of Mochi say to each other.
// Plain code with no VS Code or browser dependency: both sides import it.
//
// The panel shows what it's told and reports clicks; every word it shows
// comes from Mochi (strings.ts and the pack), so the panel has none of its
// own. Messages from the panel are checked here before Mochi acts on them.

export type Glyph = "here" | "purring" | "napping";

// Everything the panel shows. Sent whenever something changes, and when the
// panel opens.
export interface PanelState {
  mood: { glyph: Glyph; words: string };
  // Today's greeting, the same line all day, or the first-run welcome.
  greeting: string;
  // The welcome's button ("Set up Copilot" or "Choose a brain"), if any.
  welcomeButton?: string;
  buttons: { explain: string; focus: string; dark: string };
  ask: { label: string; send: string };
}

export type ToPanel =
  | { type: "show"; state: PanelState }
  // A short line under the buttons, like the hint when there's nothing to
  // explain.
  | { type: "hint"; text: string }
  // Whether what she asked was sent. If not, the panel puts it back.
  | { type: "asked"; sent: boolean }
  // "Forget everything": clear the unsent draft.
  | { type: "forget" };

export type PanelButton = "explain" | "focus" | "dark" | "welcome";

export type FromPanel =
  | { type: "ready" }
  | { type: "ask"; text: string }
  | { type: "button"; button: PanelButton };

// The longest message the box accepts, so a huge paste can't slip through.
export const MAX_ASK_LENGTH = 20_000;

const BUTTONS: readonly PanelButton[] = ["explain", "focus", "dark", "welcome"];

// A message from the panel, or undefined if it isn't one Mochi knows.
export function toFromPanel(value: unknown): FromPanel | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "ready":
      return { type: "ready" };
    case "ask":
      return typeof message.text === "string" && message.text.trim() !== "" && message.text.length <= MAX_ASK_LENGTH
        ? { type: "ask", text: message.text }
        : undefined;
    case "button":
      return BUTTONS.includes(message.button as PanelButton) ? { type: "button", button: message.button as PanelButton } : undefined;
    default:
      return undefined;
  }
}

// Enter sends, Shift+Enter adds a line. Never while she's still composing
// a character with an input method (Japanese, Chinese, Korean, and others).
export const sendsOnKey = (key: string, shift: boolean, composing: boolean): boolean =>
  key === "Enter" && !shift && !composing;
