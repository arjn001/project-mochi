// What the "Make it yours" page (MOCHI-43) and the rest of Mochi say to
// each other. Plain code with no VS Code or browser dependency: both sides
// import it. Like the panel, the page shows what it's told and reports what
// she changes; every word comes from Mochi. Messages from the page are
// checked here before Mochi acts on them.

// Everything the page shows.
export interface YoursState {
  title: string;
  sections: { about: string; talk: string; brain: string; focus: string; touches: string };
  saved: string;
}

export type ToYours = { type: "show"; state: YoursState };

export type FromYours = { type: "ready" };

// A message from the page, or undefined if it isn't one Mochi knows.
export function toFromYours(value: unknown): FromYours | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "ready":
      return { type: "ready" };
    default:
      return undefined;
  }
}
