// Her own Claude key (MOCHI-53, part 2), through the official Claude SDK.
// Plain code with no VS Code dependency.
//
// Her key only ever goes to the Claude API. Nothing from the environment can
// change that: a cloned project or a dev container can set ANTHROPIC_*
// variables, so every setting the SDK would read from them is passed
// explicitly, and every request is checked again on its way out.
import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { claudeKeyStrings } from "../strings";
import { Turn } from "./history";
import { BrainError, BrainHelp, BrainProblem } from "./provider";

// The only address her key is sent to.
export const CLAUDE_API = "https://api.anthropic.com";

// Claude Console pages she's sent to (checked 2026-10-08).
export const CONSOLE_KEYS = "https://platform.claude.com/settings/keys";
export const CONSOLE_BILLING = "https://platform.claude.com/settings/billing";

// The model marked "Good starting point for explanations": the cheapest
// current Claude model that explains well (checked 2026-10-08). The one
// place to change it.
export const STARTING_POINT = "claude-haiku-4-5";

// The longest answer, in tokens: plenty for an explanation, and it keeps a
// runaway answer from running up her bill. Models that think count their
// thinking toward it.
export const MAX_ANSWER_TOKENS = 4_000;

// How long to wait for Claude to start answering (the SDK's default is 10
// minutes).
export const REQUEST_TIMEOUT_MS = 30_000;

// How long an answer can go quiet before Mochi gives up on it, keeping what
// was written so far. Anything Claude sends counts, down to its keep-alive
// pings (which the SDK hides), so a model that's still thinking isn't cut
// off; only a connection that's gone silent is.
export const IDLE_TIMEOUT_MS = 30_000;

// One quick retry for a busy moment or a dropped connection, so she isn't
// left waiting through several.
export const MAX_RETRIES = 1;

// Headers a request may carry. Anything else, like headers added through
// ANTHROPIC_CUSTOM_HEADERS, is dropped.
const ALLOWED_HEADERS = /^(accept|content-type|content-length|user-agent|anthropic-version|anthropic-beta|idempotency-key|x-stainless-.+)$/i;

const SILENT = { error() {}, warn() {}, info() {}, debug() {} };

// An answer asks to be told whenever bytes arrive, by tagging its request
// with this header. The header itself never leaves Mochi: it isn't in
// ALLOWED_HEADERS.
const WATCH = "x-mochi-watch";
const watchers = new Map<string, () => void>();

// Every request goes out through here: to Claude's address only, with her
// key and nothing from the environment. VS Code's fetch is read at call
// time, since VS Code patches it to follow its proxy settings.
function guardedFetch(key: string): NonNullable<ClientOptions["fetch"]> {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== CLAUDE_API) {
      throw new Error("Mochi only sends your Claude key to the Claude API.");
    }
    const asked = new Headers(init?.headers);
    const headers = new Headers();
    asked.forEach((value, name) => {
      if (ALLOWED_HEADERS.test(name)) {
        headers.set(name, value);
      }
    });
    headers.set("x-api-key", key);
    const response = await globalThis.fetch(url, { ...init, headers });
    const watch = watchers.get(asked.get(WATCH) ?? "");
    if (!watch || !response.body) {
      return response;
    }
    const body = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, out) {
          watch();
          out.enqueue(chunk);
        },
      })
    );
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}

// A client for her key. The options are only for tests.
export function connect(key: string, options: { timeoutMs?: number; maxRetries?: number } = {}): Anthropic {
  return new Anthropic({
    apiKey: key,
    authToken: null,
    webhookKey: null,
    baseURL: CLAUDE_API,
    logLevel: "off",
    logger: SILENT,
    timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
    maxRetries: options.maxRetries ?? MAX_RETRIES,
    fetch: guardedFetch(key),
  });
}

// Why Claude couldn't answer, or couldn't check her key.
export type ClaudeProblem =
  // 401 or 403: the key is wrong, deleted, or can't use the API.
  | "keyRejected"
  // 402: billing, like no credit left.
  | "billing"
  // 429: too many requests, or a spend limit reached.
  | "rateLimited"
  // 529: Claude is busy.
  | "overloaded"
  // 404: the model is gone, like a retired model.
  | "notFound"
  // 413: too much to send at once.
  | "tooLong"
  // Other 400s: Claude couldn't take the request.
  | "badRequest"
  // 500 and up: something went wrong on Claude's side.
  | "serverError"
  // No connection, so maybe offline or a restricted network.
  | "offline"
  // No answer started within REQUEST_TIMEOUT_MS, or it went quiet for
  // IDLE_TIMEOUT_MS.
  | "timeout"
  // The model chose not to answer (a refusal).
  | "declined"
  // The answer reached MAX_ANSWER_TOKENS. Not an error: she can keep going.
  | "cutOff"
  | "other";

// Carries only the problem and the HTTP status: never the SDK's error, its
// message, or the request, so her key can't travel with it.
export class ClaudeError extends Error {
  constructor(readonly problem: ClaudeProblem, readonly status?: number) {
    super(status ? `Claude couldn't answer (${problem}, ${status}).` : `Claude couldn't answer (${problem}).`);
    this.name = "ClaudeError";
  }
}

export function toClaudeError(error: unknown): ClaudeError {
  if (error instanceof ClaudeError) {
    return error;
  }
  // The connection errors are APIErrors too, so they're checked first.
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ClaudeError("timeout");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ClaudeError("offline");
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return new ClaudeError("keyRejected", status);
    }
    if (status === 402) {
      return new ClaudeError("billing", status);
    }
    if (status === 429) {
      return new ClaudeError("rateLimited", status);
    }
    // An error in the middle of a stream has no status, only a type.
    if (status === 529 || error.type === "overloaded_error") {
      return new ClaudeError("overloaded", status);
    }
    if (status === 404) {
      return new ClaudeError("notFound", status);
    }
    if (status === 413) {
      return new ClaudeError("tooLong", status);
    }
    if (status === 400) {
      return new ClaudeError("badRequest", status);
    }
    if (status !== undefined && status >= 500) {
      return new ClaudeError("serverError", status);
    }
  }
  return new ClaudeError("other");
}

// Which of Mochi's lines she sees for each problem with an answer, and the
// button next to it. Low credit can come back as a plain 400, and Mochi
// never matches error text, so the general line offers the Console too.
const ANSWER_PROBLEMS: Record<ClaudeProblem, [BrainProblem, BrainHelp?]> = {
  keyRejected: ["keyRejected", "addClaudeKey"],
  billing: ["billing", "claudeBilling"],
  rateLimited: ["blocked"],
  overloaded: ["busy"],
  notFound: ["gone"],
  tooLong: ["tooLong"],
  offline: ["offline"],
  timeout: ["offline"],
  declined: ["declined"],
  cutOff: ["cutOff", "keepGoing"],
  badRequest: ["other", "claudeBilling"],
  serverError: ["other", "claudeBilling"],
  other: ["other", "claudeBilling"],
};

export function toBrainError(error: ClaudeError): BrainError {
  const [problem, help] = ANSWER_PROBLEMS[error.problem];
  return new BrainError(problem, error.message, help);
}

// A Claude model her key can use.
export interface ClaudeModel {
  id: string;
  name: string;
  // Unknown for some models.
  maxInputTokens: number | null;
}

// Marked "Good starting point for explanations": STARTING_POINT, or a dated
// version of it, like claude-haiku-4-5-20251001.
export const isStartingPoint = (id: string): boolean =>
  id === STARTING_POINT || new RegExp(`^${STARTING_POINT}-\\d{8}$`).test(id);

// What's wrong with what she pasted, if anything. Only the obvious: the
// free check with Claude says whether the key works.
export function keyInputProblem(typed: string): string | undefined {
  const key = typed.trim();
  if (key === "") {
    return claudeKeyStrings.empty;
  }
  if (/\s/.test(key)) {
    return claudeKeyStrings.space;
  }
  return undefined;
}

// Starting point first, then newest first, as Claude lists them.
export const startingPointFirst = (models: readonly ClaudeModel[]): ClaudeModel[] => [
  ...models.filter((model) => isStartingPoint(model.id)),
  ...models.filter((model) => !isStartingPoint(model.id)),
];

// A saved listing, read back from Mochi's storage. Anything that doesn't
// look like one is ignored.
export function toSavedModels(value: unknown): ClaudeModel[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((model) => typeof model?.id === "string" && typeof model?.name === "string")
    .map((model) => ({
      id: model.id,
      name: model.name,
      maxInputTokens: typeof model.maxInputTokens === "number" ? model.maxInputTokens : null,
    }));
}

export type Listing ={ ok: true; models: ClaudeModel[] } | { ok: false; problem: ClaudeProblem };

// Every model her key can use, from the free model listing, newest first.
// Retired and deprecated models are left out: retired ones can't answer,
// and deprecated ones are closed to new keys.
export async function listModels(claude: Anthropic): Promise<Listing> {
  try {
    const models: ClaudeModel[] = [];
    for await (const model of claude.models.list({ limit: 100 })) {
      if (model.lifecycle === "active") {
        models.push({ id: model.id, name: model.display_name, maxInputTokens: model.max_input_tokens });
      }
    }
    return { ok: true, models };
  } catch (error) {
    return { ok: false, problem: toClaudeError(error).problem };
  }
}

// Asks Claude to pick up an answer that reached MAX_ANSWER_TOKENS. Newer
// models reject a request that ends on their own words, so this is a turn
// from her side, after the answer so far.
export const KEEP_GOING = "Please keep going from exactly where you stopped, without repeating anything.";

// What's sent: the recent messages, her message, and for "Keep going", the
// answer so far and KEEP_GOING. With nothing written yet (a model that
// thought until the limit), there's nothing to continue, so her message is
// asked again.
export function conversationFor(message: string, soFar?: string, history: readonly Turn[] = []): Anthropic.MessageParam[] {
  const before: Anthropic.MessageParam[] = history.map((turn) => ({ role: turn.from === "her" ? "user" : "assistant", content: turn.text }));
  const asked: Anthropic.MessageParam = { role: "user", content: message };
  return soFar
    ? [...before, asked, { role: "assistant", content: soFar }, { role: "user", content: KEEP_GOING }]
    : [...before, asked];
}

export interface AnswerOptions {
  history?: readonly Turn[];
  signal?: AbortSignal;
  // Only for tests.
  idleMs?: number;
  soFar?: string;
}

// Streams Claude's answer as it's written. Mochi's rules go in the system
// prompt. `soFar` continues an answer that reached the length limit.
// Stopping (the signal) ends the answer quietly. An answer that reaches the
// limit is thrown as "cutOff", one that goes quiet for idleMs as a timeout,
// and anything else that goes wrong as a ClaudeError. What was written so
// far has already been handed out either way.
export async function* answer(
  claude: Anthropic,
  model: string,
  instructions: string,
  message: string,
  { history, signal, idleMs = IDLE_TIMEOUT_MS, soFar }: AnswerOptions = {}
): AsyncIterable<string> {
  const stop = new AbortController();
  const stopped = () => stop.abort();
  signal?.addEventListener("abort", stopped);
  let wentQuiet = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const stillHere = () => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      wentQuiet = true;
      stop.abort();
    }, idleMs);
  };
  const watchId = randomUUID();
  watchers.set(watchId, stillHere);
  try {
    stillHere();
    const stream = claude.messages.stream(
      {
        model,
        max_tokens: MAX_ANSWER_TOKENS,
        system: instructions,
        messages: conversationFor(message, soFar, history),
      },
      { signal: stop.signal, headers: { [WATCH]: watchId } }
    );
    let cutOff = false;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      } else if (event.type === "message_delta" && event.delta.stop_reason === "refusal") {
        throw new ClaudeError("declined");
      } else if (event.type === "message_delta" && event.delta.stop_reason === "max_tokens") {
        cutOff = true;
      }
    }
    if (cutOff) {
      throw new ClaudeError("cutOff");
    }
  } catch (error) {
    if (wentQuiet) {
      throw new ClaudeError("timeout");
    }
    if (signal?.aborted || error instanceof Anthropic.APIUserAbortError) {
      return;
    }
    throw toClaudeError(error);
  } finally {
    clearTimeout(idle);
    watchers.delete(watchId);
    signal?.removeEventListener("abort", stopped);
  }
}
