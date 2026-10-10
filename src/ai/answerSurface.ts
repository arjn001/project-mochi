// Where Mochi's answers appear. Plain interface with no VS Code dependency.
// The chat in Mochi's panel implements it (panel/chatLog.ts, MOCHI-21).
export interface AnswerSurface {
  // Starts a new answer to what she asked: `asked` is her side of the chat,
  // like "what's a list?" or "Explain the error on line 12 of homework.py".
  start(asked: string): void;
  // Adds text as the answer streams in.
  append(text: string): void;
  finish(): void;
  // Picks the last answer up again, for "Keep going" (MOCHI-67): what's
  // appended next continues it.
  resume(): void;
  // Offers next steps, like "Give me a hint" and "Show the fix". Resolves
  // with her pick, or undefined if she moved on without picking one.
  offerNext(prompt: string, choices: string[]): Promise<string | undefined>;
  // One line from Mochi that isn't an answer, like "I'll think once you
  // pick a brain."
  say(line: string): void;
  // A kind line about a problem, with a button when she can do something.
  // Resolves true if she clicked it.
  problem(line: string, action?: string): Promise<boolean>;
}
