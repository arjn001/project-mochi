// Choosing which brain Mochi thinks with (MOCHI-53, part 1). Plain code with
// no VS Code dependency.
//
// Mochi uses her pick if it's there, otherwise Copilot's Auto. It never picks
// any other model without her: with no Auto and no pick, it asks. On Copilot
// Free and Student, Auto is the only model; every chat message uses her
// Copilot plan (see DECISIONS.md), and Mochi only thinks when she asks.
import { brainStrings, chatStrings } from "../strings";

// What Mochi needs to know about a model VS Code's built-in AI offers.
export interface BrainInfo {
  vendor: string;
  id: string;
  name: string;
  maxInputTokens: number;
}

// Copilot's own helper models, which aren't for chatting. The one place to
// add another.
export const HELPER_MODELS: readonly RegExp[] = [/^copilot-utility/, /^copilot-dictation/];

// A brain she can chat with: not a helper model, and able to take a message
// at all (Copilot CLI's entry has an input limit of 0).
export const isUsable = (brain: BrainInfo): boolean =>
  brain.maxInputTokens > 0 && !HELPER_MODELS.some((pattern) => pattern.test(brain.id));

export const brainKey = (brain: { vendor: string; id: string }) => `${brain.vendor}/${brain.id}`;

// Models reached with her own Claude key (MOCHI-53, part 2), like
// "claude-key/claude-haiku-4-5" in the mochi.brain setting. A name no
// extension's models would use, so the two never mix.
export const CLAUDE_VENDOR = "claude-key";

const VENDOR_NAMES: Record<string, string> = { copilot: "Copilot" };
const vendorName = (vendor: string) => VENDOR_NAMES[vendor] ?? vendor.charAt(0).toUpperCase() + vendor.slice(1);

// How a brain is shown to her: "Copilot · Auto". Her Claude models already
// say Claude: "Claude Haiku 4.5".
export const brainLabel = (brain: { vendor: string; name: string }) =>
  brain.vendor === CLAUDE_VENDOR ? brain.name : `${vendorName(brain.vendor)} · ${brain.name}`;

// The brain at the top of the chat (MOCHI-21): its name, or the command's
// name when Mochi would ask her first. One click opens Choose a brain.
export function brainButton(brain: string | undefined): { label: string; tooltip: string; spoken: string } {
  return brain
    ? { label: brain, tooltip: chatStrings.chooseBrain, spoken: chatStrings.brainSpoken(brain) }
    : { label: chatStrings.chooseBrain, tooltip: chatStrings.chooseBrain, spoken: chatStrings.chooseBrain };
}

export const isAuto = (brain: { vendor: string; id: string }) => brain.vendor === "copilot" && brain.id === "auto";

// The mochi.brain setting: "vendor/id", like "copilot/auto". Empty or
// malformed means "let Mochi choose", the same way odd speak-up values mean
// gentle.
export function toBrainSetting(value: unknown): { vendor: string; id: string } | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = /^([a-z0-9][a-z0-9._-]*)\/(\S{1,200})$/i.exec(value.trim());
  return match ? { vendor: match[1], id: match[2] } : undefined;
}

export type Choice<T extends BrainInfo> =
  // No brain at all: Mochi offers to set one up.
  | { kind: "none" }
  // No Auto and no pick: Mochi asks her, and never picks for her.
  | { kind: "ask"; usable: T[] }
  // `missing` is set when her pick isn't available and Auto stands in.
  | { kind: "use"; brain: T; missing?: { vendor: string; id: string } };

export function chooseBrain<T extends BrainInfo>(setting: unknown, available: readonly T[]): Choice<T> {
  const usable = available.filter(isUsable);
  if (usable.length === 0) {
    return { kind: "none" };
  }
  const auto = usable.find(isAuto);
  const pick = toBrainSetting(setting);
  if (pick) {
    const found = usable.find((brain) => brainKey(brain) === brainKey(pick));
    if (found) {
      return { kind: "use", brain: found };
    }
    // Her pick is gone (signed out, an extension removed, another machine).
    return auto ? { kind: "use", brain: auto, missing: pick } : { kind: "ask", usable };
  }
  return auto ? { kind: "use", brain: auto } : { kind: "ask", usable };
}

// The "Quick note" about a stand-in brain, shown once per change: not on
// every answer, but again if her pick comes back and later disappears.
// `noted` is what was last shown; the result says what to remember now.
export function fallbackNote(
  choice: { missing?: { vendor: string; id: string }; brain: BrainInfo },
  noted: string | undefined,
  missingLabel: string | undefined
): { note?: string; noted: string | undefined } {
  if (!choice.missing) {
    return { noted: undefined };
  }
  const change = `${brainKey(choice.missing)}>${brainKey(choice.brain)}`;
  if (change === noted) {
    return { noted };
  }
  return {
    note: brainStrings.fallback(missingLabel ?? choice.missing.id, brainLabel(choice.brain)),
    noted: change,
  };
}
