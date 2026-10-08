// Her own Claude key (MOCHI-53, part 2), through the official Claude SDK.
// Plain code with no VS Code dependency.
//
// Her key only ever goes to the Claude API. Nothing from the environment can
// change that: a cloned project or a dev container can set ANTHROPIC_*
// variables, so every setting the SDK would read from them is passed
// explicitly, and every request is checked again on its way out.
import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";

// The only address her key is sent to.
export const CLAUDE_API = "https://api.anthropic.com";

// The model marked "Good starting point for explanations": the cheapest
// current Claude model that explains well (checked 2026-10-08). The one
// place to change it.
export const STARTING_POINT = "claude-haiku-4-5";

// The longest answer, in tokens. Explanations are much shorter; this only
// stops a runaway answer from running up her bill. Models that think count
// their thinking toward it, so it can't be much lower.
export const MAX_ANSWER_TOKENS = 16_000;

// How long to wait for Claude to start answering (the SDK's default is 10
// minutes). Once an answer is streaming, Stop or Cancel ends it.
export const REQUEST_TIMEOUT_MS = 30_000;

// One quick retry for a busy moment or a dropped connection, so she isn't
// left waiting through several.
export const MAX_RETRIES = 1;

// Headers a request may carry. Anything else, like headers added through
// ANTHROPIC_CUSTOM_HEADERS, is dropped.
const ALLOWED_HEADERS = /^(accept|content-type|content-length|user-agent|anthropic-version|anthropic-beta|idempotency-key|x-stainless-.+)$/i;

const SILENT = { error() {}, warn() {}, info() {}, debug() {} };

// Every request goes out through here: to Claude's address only, with her
// key and nothing from the environment. VS Code's fetch is read at call
// time, since VS Code patches it to follow its proxy settings.
function guardedFetch(key: string): NonNullable<ClientOptions["fetch"]> {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== CLAUDE_API) {
      throw new Error("Mochi only sends your Claude key to the Claude API.");
    }
    const headers = new Headers();
    new Headers(init?.headers).forEach((value, name) => {
      if (ALLOWED_HEADERS.test(name)) {
        headers.set(name, value);
      }
    });
    headers.set("x-api-key", key);
    return globalThis.fetch(url, { ...init, headers });
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
  // No answer started within REQUEST_TIMEOUT_MS.
  | "timeout"
  // The model chose not to answer (a refusal).
  | "declined"
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

export type Listing = { ok: true; models: ClaudeModel[] } | { ok: false; problem: ClaudeProblem };

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

// Streams Claude's answer as it's written. Mochi's rules go in the system
// prompt. Stopping (the signal) ends the answer quietly; anything else that
// goes wrong is thrown as a ClaudeError.
export async function* answer(
  claude: Anthropic,
  model: string,
  instructions: string,
  message: string,
  signal?: AbortSignal
): AsyncIterable<string> {
  try {
    const stream = claude.messages.stream(
      {
        model,
        max_tokens: MAX_ANSWER_TOKENS,
        system: instructions,
        messages: [{ role: "user", content: message }],
      },
      { signal }
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      } else if (event.type === "message_delta" && event.delta.stop_reason === "refusal") {
        throw new ClaudeError("declined");
      }
    }
  } catch (error) {
    if (signal?.aborted || error instanceof Anthropic.APIUserAbortError) {
      return;
    }
    throw toClaudeError(error);
  }
}
