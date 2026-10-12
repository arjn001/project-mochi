// Noticing when she says she finished something (MOCHI-36). Plain code with
// no VS Code dependency, and no AI: it runs on her computer, costs nothing,
// and works with no brain.
//
// It's careful on purpose. A missed "yay" is better than a wrong one, and
// "I'm done" often means giving up, so anything that sounds like a
// question, a problem, or frustration goes to the brain as usual.

import { Pack } from "../packs/format";
import { pickPhrase } from "../packs/phrases";

// What she finished, as plain words she wrote, or nothing to name ("done!").
export type Finished = { thing?: string };

// What Mochi says: the specific thing, from the pack's celebrate lines, or
// "Yay, you did it!" when there's nothing to name.
export function celebrationLine(pack: Pack, finished: Finished, random?: () => number): string {
  return finished.thing ? pickPhrase(pack, "celebrate", { thing: finished.thing }, random) : pickPhrase(pack, "celebrateDone", {}, random);
}

// The longest message that can be a celebration, and the longest thing
// Mochi repeats back.
const MAX_MESSAGE = 120;
const MAX_THING = 60;

// Words that mean it's a question or a problem, not a celebration.
const QUESTION = ["but", "why", "how", "what", "error", "errors", "help", "not", "almost", "nearly", "halfway", "yet"];

// Words that mean she might be giving up or upset (agreed 2026-10-12).
const FRUSTRATION = [
  "give up",
  "giving up",
  "gave up",
  "quit",
  "quitting",
  "hate",
  "tired",
  "can't",
  "cant",
  "cannot",
  "ugh",
  "stuck",
  "still",
  "wrong",
  "broke",
  "broken",
  "fail",
  "failed",
  "failing",
  "doesn't",
  "doesnt",
  "won't",
  "wont",
  "worst",
  "crying",
  "cry",
  "never",
];

// A "thing" this vague is more likely "I'm done with it all" than a win.
const VAGUE = new Set(["this", "it", "everything", "coding", "this class", "that", "all", "all of it", "all this", "this course", "programming", "this stuff", "life", "school"]);

// Cheerful words that make a bare "done" a celebration: "yay, done",
// "finally finished :)". A "!" alone isn't enough: "I'm done!" can be
// frustration too.
const CHEER = /\b(yay|yes|woohoo|woo|finally|omg)\b|:\)|:D/i;

const word = (list: readonly string[]) => new RegExp(`(^|[^\\p{L}'])(${list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^\\p{L}'])`, "iu");
const HAS_QUESTION = word(QUESTION);
const HAS_FRUSTRATION = word(FRUSTRATION);
// "didn't", "isn't", "wasn't", and the like.
const HAS_NOT = /n't\b/i;

// Only plain words and ordinary punctuation are repeated back, so nothing
// she typed can become formatting or a link in Mochi's message (the chat's
// formatter has no escapes).
const PLAIN_THING = /^[\p{L}\p{N} .,'&+\/:-]+$/u;
// Anything that looks like an address, which the formatter could turn into a
// link.
const LINK = /:\/\/|\bwww\.|\bhttps?\b/i;

// Her words, as Mochi says them back: "my homework" becomes "your homework".
function yourThing(thing: string): string {
  return thing.replace(/\b(my|mine|our|ours|myself|me)\b/gi, (w) => {
    const swap: Record<string, string> = { my: "your", mine: "yours", our: "your", ours: "yours", myself: "yourself", me: "you" };
    return swap[w.toLowerCase()];
  });
}

// The finishing statements Mochi understands. The first group, if any, is
// the thing. `bare` patterns never name one, like "It finally works".
const PATTERNS: { pattern: RegExp; bare?: boolean }[] = [
  // "I finished question 3", "I've finally completed my homework", "I did the loop", "I finished"
  { pattern: /^(?:i|we)(?:'ve| have)?\s+(?:finally\s+|just\s+)?(?:finished|completed|did|done)(?:\s+(.+))?$/i },
  // "I'm done with question 3", "I am finally finished with my essay", "I'm done"
  { pattern: /^(?:i'm|im|i am|we're|we are)\s+(?:finally\s+|all\s+)?(?:done|finished)(?:\s+with\s+(.+))?$/i },
  // "question 3 is done", "my homework is finally finished", "the loops are complete"
  { pattern: /^(.+?)\s+(?:is|are)\s+(?:finally\s+|all\s+)?(?:done|finished|complete|completed)$/i },
  // "done with question 3", "finished my homework", "finally done"
  { pattern: /^(?:finally\s+)?(?:done|finished|completed)(?:\s+with)?(?:\s+(.+))?$/i },
  // "It finally works", "my code works now"
  { pattern: /^(?:it|my code|the code|my program|the program)\s+(?:finally\s+)?works(?:\s+now)?$/i, bare: true },
];

// What she finished, if her message says she finished something, or
// undefined if it doesn't (or Mochi isn't sure).
export function finishedSomething(message: string): Finished | undefined {
  const text = message.trim().replace(/[\u2018\u2019]/g, "'");
  if (text === "" || text.length > MAX_MESSAGE || /[\r\n?]/.test(text)) {
    return undefined;
  }
  if (HAS_QUESTION.test(text) || HAS_FRUSTRATION.test(text) || HAS_NOT.test(text)) {
    return undefined;
  }
  // The statement itself, without cheers around it: "Yay! I finished it :)"
  const core = text
    .replace(/^(?:(?:yay|yes|woohoo|woo|omg|mochi|hey)\b[\s,!.]*)+/i, "")
    .replace(/(?:\s*(?::\)|:D|!+|\.+))+$/, "")
    .trim();
  for (const { pattern, bare } of PATTERNS) {
    const match = pattern.exec(core);
    if (!match) {
      continue;
    }
    if (bare) {
      return {};
    }
    const named = match[1]?.trim().replace(/^finally\s+/i, "").replace(/[\s.,!]+$/, "");
    // A bare "I'm done" or "finished" is only a celebration with a cheer.
    if (!named) {
      return CHEER.test(text) ? {} : undefined;
    }
    if (VAGUE.has(named.toLowerCase())) {
      return undefined;
    }
    // Too long or not plain words: celebrate, but don't repeat it back.
    if (named.length > MAX_THING || !PLAIN_THING.test(named) || LINK.test(named)) {
      return {};
    }
    return { thing: yourThing(named) };
  }
  return undefined;
}
