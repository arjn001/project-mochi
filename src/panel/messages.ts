// What Mochi's panel (MOCHI-16) and the rest of Mochi say to each other.
// Plain code with no VS Code or browser dependency: both sides import it.
//
// The panel shows what it's told and reports clicks; every word it shows
// comes from Mochi (strings.ts and the pack), so the panel has none of its
// own. Messages from the panel are checked here before Mochi acts on them.

export type Glyph = "here" | "purring" | "napping";

// Next steps under a message, like "Give me a hint" or "Keep going".
export interface ChatChips {
  prompt?: string;
  choices: { id: string; label: string }[];
}

// One message in the chat (MOCHI-21). Text only: the panel formats it with
// panel/format.ts and builds it from text nodes, never as HTML.
export interface ChatEntry {
  id: number;
  from: "her" | "mochi";
  text: string;
  chips?: ChatChips;
  // A kind line about a problem, not an answer.
  problem?: boolean;
}

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
  chat: { empty: string; you: string; mochi: string; copy: string; copied: string };
}

export type ToPanel =
  | { type: "show"; state: PanelState; chat: readonly ChatEntry[] }
  // The whole chat, after a new message or chips.
  | { type: "chat"; chat: readonly ChatEntry[] }
  // More of an answer as it streams in.
  | { type: "append"; id: number; text: string }
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
  | { type: "button"; button: PanelButton }
  | { type: "chip"; entry: number; chip: string }
  // Copy only copies: Mochi puts the text on her clipboard, nothing else.
  | { type: "copy"; text: string }
  // Opened through VS Code, and only if it's an https link (format.ts).
  | { type: "openLink"; url: string };

// The longest message the box accepts, so a huge paste can't slip through.
export const MAX_ASK_LENGTH = 20_000;
// The longest code block Copy will put on her clipboard.
export const MAX_COPY_LENGTH = 200_000;

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
    case "chip":
      return Number.isInteger(message.entry) && typeof message.chip === "string" && message.chip.length <= 10
        ? { type: "chip", entry: message.entry as number, chip: message.chip }
        : undefined;
    case "copy":
      return typeof message.text === "string" && message.text.length <= MAX_COPY_LENGTH ? { type: "copy", text: message.text } : undefined;
    case "openLink":
      // Checked again where it's opened: https only, nothing hidden.
      return typeof message.url === "string" && message.url.length <= 2_000 ? { type: "openLink", url: message.url } : undefined;
    default:
      return undefined;
  }
}

// Enter sends, Shift+Enter adds a line. Never while she's still composing
// a character with an input method (Japanese, Chinese, Korean, and others).
export const sendsOnKey = (key: string, shift: boolean, composing: boolean): boolean =>
  key === "Enter" && !shift && !composing;
