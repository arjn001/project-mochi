// The rules for "dim things with a darker theme". Plain code with no VS Code
// dependency, so it can be unit tested alone.

// One of VS Code's built-in themes, present in every version Mochi supports.
export const DARKER_THEME = "Dark Modern";

export type ThemeKind = "light" | "dark" | "highContrast";

export const dimTexts = {
  question: "Want me to dim things with a darker theme?",
  yes: "Dim things",
  done: "Dimmed! Changed your mind?",
};

// Why there's nothing to do, or undefined if Mochi should offer.
export function skipDimming(kind: ThemeKind): string | undefined {
  switch (kind) {
    case "dark":
      return "You're already on a dark theme. Cozy!";
    case "highContrast":
      // Someone using high contrast most likely needs it. Never change it.
      return "You're using a high contrast theme, so I'll leave it just as it is.";
    case "light":
      return undefined;
  }
}
