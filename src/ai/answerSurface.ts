// Where Mochi's answers appear. Plain interface with no VS Code dependency.
// For now the "Mochi" output panel implements it (outputSurface.ts); the
// panel chat (MOCHI-21) implements the same interface and replaces it,
// without changing any code that asks or explains.
export interface AnswerSurface {
  // Starts a new answer under a heading, like "You: what is a list?"
  start(heading: string, speaker: string): void;
  // Adds text as the answer streams in.
  append(text: string): void;
  finish(): void;
  // Picks the last answer up again, for "Keep going" (MOCHI-67): what's
  // appended next continues it.
  resume(): void;
  // Offers next steps, like "Give me a hint" and "Show the fix". Resolves
  // with her pick, or undefined if she didn't pick one.
  offerNext(prompt: string, choices: string[]): Promise<string | undefined>;
}
