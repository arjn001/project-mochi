// The rules for "Switch to a dark theme". Plain code with no VS Code
// dependency, so it can be unit tested alone.

// One of VS Code's built-in themes, present in every version Mochi supports.
export const DARKER_THEME = "Dark Modern";

export type ThemeKind = "light" | "dark" | "highContrast";

// "Switch to a dark theme" is also the command's name and the panel's
// button, so she learns one name for it.
export const dimTexts = {
  question: "Want me to switch to a dark theme?",
  yes: "Switch to a dark theme",
  done: "Switched to a dark theme. Changed your mind?",
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
