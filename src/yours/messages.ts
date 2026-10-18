// What the "Make it yours" page (MOCHI-43) and the rest of Mochi say to
// each other. Plain code with no VS Code or browser dependency: both sides
// import it. Like the panel, the page shows what it's told and reports what
// she changes; every word comes from Mochi. Messages from the page are
// checked here before Mochi acts on them.

// One thing she can change. The page draws each kind the same way.
export type Field =
  // A line of text, saved on Enter or when she leaves the field.
  | { kind: "text"; id: FieldId; label: string; value: string; placeholder: string; maxLength: number; note?: string }
  | { kind: "choice"; id: FieldId; label: string; value: string; options: { value: string; label: string; description: string }[]; note?: string }
  | { kind: "toggle"; id: FieldId; label: string; description: string; value: boolean; note?: string }
  | { kind: "number"; id: FieldId; label: string; description: string; value: number; min: number; max: number; note?: string }
  // Something she does with a button, like choosing a brain. `now` says how
  // things are.
  | { kind: "actions"; now: string; buttons: { id: ButtonId; label: string }[] };

export interface Section {
  heading: string;
  fields: Field[];
}

// Everything the page shows.
export interface YoursState {
  title: string;
  saved: string;
  sections: Section[];
}

// The fields Mochi knows. Anything else from the page is ignored.
export const FIELDS = ["name", "speakUp", "learningMode", "focusMinutes", "lateHour"] as const;
export type FieldId = (typeof FIELDS)[number];

export type ToYours =
  | { type: "show"; state: YoursState }
  // After an edit: saved, or a kind hint about why not.
  | { type: "result"; field: FieldId; ok: true }
  | { type: "result"; field: FieldId; ok: false; hint: string };

// Buttons on the page, each running a command she could run herself.
export const BUTTONS = ["forgetName", "chooseBrain", "addClaudeKey", "removeClaudeKey"] as const;
export type ButtonId = (typeof BUTTONS)[number];

export type FromYours =
  | { type: "ready" }
  | { type: "edit"; field: FieldId; value: string | number | boolean }
  | { type: "button"; button: ButtonId };

// The longest value the page may send. Every field checks its own limits.
const MAX_VALUE = 10_000;

// A message from the page, or undefined if it isn't one Mochi knows.
export function toFromYours(value: unknown): FromYours | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "ready":
      return { type: "ready" };
    case "edit": {
      const sent = message.value;
      const fine =
        typeof sent === "boolean" || (typeof sent === "number" && Number.isFinite(sent)) || (typeof sent === "string" && sent.length <= MAX_VALUE);
      return FIELDS.includes(message.field as FieldId) && fine ? { type: "edit", field: message.field as FieldId, value: sent as string | number | boolean } : undefined;
    }
    case "button":
      return BUTTONS.includes(message.button as ButtonId) ? { type: "button", button: message.button as ButtonId } : undefined;
    default:
      return undefined;
  }
}
