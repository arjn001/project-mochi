// The recent messages sent along with each question, so the brain can follow
// the conversation (MOCHI-21). Plain code with no VS Code dependency.
//
// Only the newest ones that fit a size budget are sent; the rest stay in the
// chat on her computer. Attached code is never sent again: her message
// carries a short note of what was shared with it instead.

// One message of the conversation, as a brain sees it.
export interface Turn {
  from: "her" | "mochi";
  text: string;
}

// About 3,000 words, in characters.
export const HISTORY_CHARS = 16_000;

// The budget for a brain: HISTORY_CHARS, or less for a brain that can't take
// much. A token is about four characters, so this is at most a quarter of
// what the brain can take, leaving room for Mochi's rules, her question,
// and anything attached.
export const historyBudget = (maxInputTokens?: number): number =>
  maxInputTokens && maxInputTokens > 0 ? Math.min(HISTORY_CHARS, Math.floor(maxInputTokens)) : HISTORY_CHARS;

interface Said {
  from: "her" | "mochi";
  text: string;
  problem?: boolean;
  shared?: string;
}

// Her messages and the answers to them, newest first until the budget is
// used, then back in order. Kind lines about problems, and messages with no
// answer, are left out, so the brain only sees a real conversation.
export function recentTurns(chat: readonly Said[], budget: number): Turn[] {
  const pairs: [Turn, Turn][] = [];
  for (let i = 0; i + 1 < chat.length; i++) {
    const asked = chat[i];
    const answer = chat[i + 1];
    if (asked.from === "her" && answer.from === "mochi" && !answer.problem && answer.text.trim() !== "") {
      const text = asked.shared ? `${asked.text}\n\n[${asked.shared}, not included again]` : asked.text;
      pairs.push([
        { from: "her", text },
        { from: "mochi", text: answer.text },
      ]);
    }
  }
  const kept: [Turn, Turn][] = [];
  let used = 0;
  for (const pair of pairs.reverse()) {
    const size = pair[0].text.length + pair[1].text.length;
    if (used + size > budget) {
      break;
    }
    used += size;
    kept.unshift(pair);
  }
  return kept.flat();
}
