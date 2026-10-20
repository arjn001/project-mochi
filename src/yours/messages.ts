// What the "Make it yours" page (MOCHI-43) and the rest of Mochi say to
// each other. Plain code with no VS Code or browser dependency: both sides
// import it. Like the panel, the page shows what it's told and reports what
// she changes; every word comes from Mochi. Messages from the page are
// checked here before Mochi acts on them.

// One thing she can change. The page draws each kind the same way.
export type Field =
  // A few sentences, saved when she leaves the field.
  | { kind: "longText"; id: FieldId; label: string; description: string; value: string; maxLength: number; note?: string }
  // Her own lines for a moment, one per row, saved when she leaves the
  // field. `example` shows Mochi's own lines.
  | { kind: "lines"; id: FieldId; label: string; description: string; value: string[]; example: string; note?: string }
  // A line of text, saved on Enter or when she leaves the field. Emptying it
  // clears it only if it's `clearable`: her own name has "Forget my name".
  | { kind: "text"; id: FieldId; label: string; value: string; placeholder: string; maxLength: number; clearable?: boolean; note?: string }
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
  // A line under the title, if the page has one.
  intro?: string;
  saved: string;
  sections: Section[];
}

// The fields Mochi knows. Anything else from the page is ignored.
// The moments she can write lines for. The same list as MOMENTS in
// packs/format.ts (a unit test checks), kept here so the page's script
// doesn't carry the pack format.
export const MOMENT_IDS = [
  "greeting",
  "greetingLate",
  "welcomeBack",
  "backToProject",
  "stuck",
  "lateNight",
  "lateNightCompany",
  "celebrate",
  "celebrateDone",
] as const;
export type MomentId = (typeof MOMENT_IDS)[number];

export const FIELDS = ["name", "speakUp", "learningMode", "focusMinutes", "lateHour", "style", ...MOMENT_IDS.map((moment) => `lines.${moment}` as const)] as const;
// The gift being made (MOCHI-55): her name, the maker's name and note, and
// the touches, never settings.
export const GIFT_FIELDS = ["gift.name", "gift.from", "gift.note", "gift.style", ...MOMENT_IDS.map((moment) => `gift.lines.${moment}` as const)] as const;
export type FieldId =
  | "name"
  | "speakUp"
  | "learningMode"
  | "focusMinutes"
  | "lateHour"
  | "style"
  | `lines.${MomentId}`
  | (typeof GIFT_FIELDS)[number];

export type ToYours =
  | { type: "show"; state: YoursState }
  // After an edit: saved, or a kind hint about why not.
  | { type: "result"; field: FieldId; ok: true }
  | { type: "result"; field: FieldId; ok: false; hint: string };

// Buttons on the page, each running a command she could run herself.
export const BUTTONS = ["forgetName", "chooseBrain", "addClaudeKey", "removeClaudeKey"] as const;
export const GIFT_BUTTONS = ["startFromMine", "startOver"] as const;
export type ButtonId = (typeof BUTTONS)[number] | (typeof GIFT_BUTTONS)[number];

export type FromYours =
  | { type: "ready" }
  | { type: "edit"; field: FieldId; value: string | number | boolean }
  | { type: "button"; button: ButtonId };

// The fields and buttons one page has. Each page accepts only its own.
export interface PageParts {
  fields: readonly FieldId[];
  buttons: readonly ButtonId[];
}
export const YOURS_PARTS: PageParts = { fields: FIELDS, buttons: BUTTONS };
export const GIFT_PARTS: PageParts = { fields: GIFT_FIELDS, buttons: GIFT_BUTTONS };

// The longest value the page may send. Every field checks its own limits.
const MAX_VALUE = 10_000;

// A message from a page, or undefined if it isn't one that page has.
export function toFromYours(value: unknown, parts: PageParts = YOURS_PARTS): FromYours | undefined {
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
      return (parts.fields as readonly string[]).includes(message.field as string) && fine ? { type: "edit", field: message.field as FieldId, value: sent as string | number | boolean } : undefined;
    }
    case "button":
      return (parts.buttons as readonly string[]).includes(message.button as string) ? { type: "button", button: message.button as ButtonId } : undefined;
    default:
      return undefined;
  }
}
