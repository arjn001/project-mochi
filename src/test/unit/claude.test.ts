import * as assert from "node:assert";
import {
  CLAUDE_API,
  ClaudeError,
  ClaudeProblem,
  KEEP_GOING,
  conversationFor,
  MAX_ANSWER_TOKENS,
  answer,
  connect,
  isStartingPoint,
  keyInputProblem,
  listModels,
  startingPointFirst,
  toBrainError,
  toSavedModels,
} from "../../ai/claude";
import { brainHelpButtons, brainProblemMessages } from "../../ai/provider";

// A made-up key, so a test can look for it anywhere it shouldn't be.
const KEY = "sk-ant-api03-test-key-0123456789abcdefghij";

type Call = { url: URL; headers: Headers; body: unknown; signal?: AbortSignal | null };
type Reply = (call: Call) => Response | Promise<Response>;

// Stands in for VS Code's fetch. Mochi reads globalThis.fetch at call time,
// so this is what every request reaches.
let calls: Call[] = [];
let reply: Reply = () => json(200, { data: [], has_more: false });
const realFetch = globalThis.fetch;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const apiError = (status: number, type: string) =>
  json(status, { type: "error", error: { type, message: `Something about ${type}` } });

const sseEvent = (event: { type: string }) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

const start = [
  {
    type: "message_start",
    message: {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 0 },
    },
  },
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
];
const delta = (text: string) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });
const end = (stopReason = "end_turn") => [
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 5 } },
  { type: "message_stop" },
];

function stream(events: { type: string }[]): Response {
  return new Response(events.map(sseEvent).join(""), { status: 200, headers: { "content-type": "text/event-stream" } });
}

const model = (id: string, name: string, lifecycle = "active") => ({
  type: "model",
  id,
  display_name: name,
  created_at: "2026-01-01T00:00:00Z",
  lifecycle,
  max_input_tokens: 200_000,
});

async function collect(pieces: AsyncIterable<string>): Promise<string[]> {
  const all: string[] = [];
  for await (const piece of pieces) {
    all.push(piece);
  }
  return all;
}

async function failure(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  assert.fail("expected an error");
}

// Everything the console would have printed.
let printed: string[] = [];
const consoleMethods = ["log", "info", "warn", "error", "debug", "trace"] as const;
const realConsole = Object.fromEntries(consoleMethods.map((name) => [name, console[name]]));

describe("her own Claude key", () => {
  beforeEach(() => {
    calls = [];
    printed = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const call: Call = {
        url: new URL(input instanceof Request ? input.url : input),
        headers: new Headers(init?.headers),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
        signal: init?.signal,
      };
      calls.push(call);
      return reply(call);
    }) as typeof fetch;
    for (const name of consoleMethods) {
      console[name] = (...args: unknown[]) => void printed.push(args.map(String).join(" "));
    }
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    Object.assign(console, realConsole);
    reply = () => json(200, { data: [], has_more: false });
  });

  describe("where her key goes", () => {
    const env = {
      ANTHROPIC_BASE_URL: "https://example.com/steal",
      ANTHROPIC_API_KEY: "sk-ant-from-the-environment",
      ANTHROPIC_AUTH_TOKEN: "token-from-the-environment",
      ANTHROPIC_LOG: "debug",
      ANTHROPIC_CUSTOM_HEADERS: "x-api-key: sk-ant-someone-else\nauthorization: Bearer someone-else\nx-sneaky: yes",
    };
    let saved: Record<string, string | undefined> = {};

    beforeEach(() => {
      saved = Object.fromEntries(Object.keys(env).map((name) => [name, process.env[name]]));
      Object.assign(process.env, env);
    });

    afterEach(() => {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    });

    it("ignores ANTHROPIC_* settings from the environment", async () => {
      const listing = await listModels(connect(KEY));
      assert.deepStrictEqual(listing, { ok: true, models: [] });
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].url.origin, CLAUDE_API);
      assert.strictEqual(calls[0].url.pathname, "/v1/models");
      assert.strictEqual(calls[0].headers.get("x-api-key"), KEY);
      assert.strictEqual(calls[0].headers.get("authorization"), null);
      assert.strictEqual(calls[0].headers.get("x-sneaky"), null);
      assert.deepStrictEqual(printed, [], "nothing is logged, even with ANTHROPIC_LOG=debug");
    });

    it("ignores them for answers too", async () => {
      reply = () => stream([...start, delta("Hi!"), ...end()]);
      assert.deepStrictEqual(await collect(answer(connect(KEY), "claude-haiku-4-5", "rules", "hello")), ["Hi!"]);
      assert.strictEqual(calls[0].url.origin, CLAUDE_API);
      assert.strictEqual(calls[0].url.pathname, "/v1/messages");
      assert.strictEqual(calls[0].headers.get("x-api-key"), KEY);
      assert.strictEqual(calls[0].headers.get("authorization"), null);
      assert.strictEqual(calls[0].headers.get("x-mochi-watch"), null, "Mochi's own header stays inside Mochi");
      assert.deepStrictEqual(printed, []);
    });

    it("uses VS Code's fetch as it is when the request is made", async () => {
      const claude = connect(KEY);
      let reachedLater = false;
      const fake = globalThis.fetch;
      globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
        reachedLater = true;
        return fake(input, init);
      }) as typeof fetch;
      await listModels(claude);
      assert.ok(reachedLater);
    });
  });

  describe("her key never leaks", () => {
    const cases: [string, Reply][] = [
      ["a rejected key (401)", () => apiError(401, "authentication_error")],
      ["a rate limit (429)", () => apiError(429, "rate_limit_error")],
      ["a server error (500)", () => apiError(500, "api_error")],
      ["Claude being busy (529)", () => apiError(529, "overloaded_error")],
      [
        "a network failure",
        () => {
          throw new TypeError(`fetch failed for ${KEY}`);
        },
      ],
    ];

    for (const [what, failWith] of cases) {
      it(`not in the error, for ${what}`, async () => {
        reply = failWith;
        const error = await failure(() => collect(answer(connect(KEY, { maxRetries: 0 }), "m", "rules", "hello")));
        assert.ok(error instanceof ClaudeError);
        assert.strictEqual(error.cause, undefined);
        const everything = [String(error), error.message, error.stack ?? "", JSON.stringify(error), ...printed].join("\n");
        assert.ok(!everything.includes(KEY), `the key showed up for ${what}`);
      });
    }

    it("not in the error, for a timeout", async () => {
      reply = (call) =>
        new Promise((_resolve, reject) =>
          call.signal?.addEventListener("abort", () => reject(new DOMException(`aborted ${KEY}`, "AbortError")))
        );
      const error = await failure(() =>
        collect(answer(connect(KEY, { timeoutMs: 20, maxRetries: 0 }), "m", "rules", "hello"))
      );
      assert.ok(error instanceof ClaudeError);
      assert.ok(![String(error), error.stack ?? "", JSON.stringify(error), ...printed].join("\n").includes(KEY));
    });

    it("not in a failed listing", async () => {
      reply = () => apiError(401, "authentication_error");
      const listing = await listModels(connect(KEY, { maxRetries: 0 }));
      assert.ok(!JSON.stringify(listing).includes(KEY));
      assert.deepStrictEqual(printed, []);
    });
  });

  describe("what went wrong", () => {
    const statuses: [number, string, string][] = [
      [400, "invalid_request_error", "badRequest"],
      [401, "authentication_error", "keyRejected"],
      [402, "billing_error", "billing"],
      [403, "permission_error", "keyRejected"],
      [404, "not_found_error", "notFound"],
      [413, "request_too_large", "tooLong"],
      [429, "rate_limit_error", "rateLimited"],
      [500, "api_error", "serverError"],
      [503, "api_error", "serverError"],
      [529, "overloaded_error", "overloaded"],
    ];

    for (const [status, type, problem] of statuses) {
      it(`${status} means ${problem}`, async () => {
        reply = () => apiError(status, type);
        assert.deepStrictEqual(await listModels(connect(KEY, { maxRetries: 0 })), { ok: false, problem });
      });
    }

    it("no connection means offline", async () => {
      reply = () => {
        throw new TypeError("fetch failed");
      };
      assert.deepStrictEqual(await listModels(connect(KEY, { maxRetries: 0 })), { ok: false, problem: "offline" });
    });

    it("Claude being busy in the middle of an answer means overloaded", async () => {
      reply = () =>
        new Response(
          [...start, delta("Let's")].map(sseEvent).join("") +
            sseEvent({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } } as { type: string }),
          { status: 200, headers: { "content-type": "text/event-stream" } }
        );
      const pieces: string[] = [];
      const error = await failure(async () => {
        for await (const piece of answer(connect(KEY), "m", "rules", "hello")) {
          pieces.push(piece);
        }
      });
      assert.deepStrictEqual(pieces, ["Let's"]);
      assert.strictEqual((error as ClaudeError).problem, "overloaded");
    });

    it("a refusal means declined, after what was already written", async () => {
      reply = () => stream([...start, delta("Hmm."), ...end("refusal")]);
      const pieces: string[] = [];
      const error = await failure(async () => {
        for await (const piece of answer(connect(KEY), "m", "rules", "hello")) {
          pieces.push(piece);
        }
      });
      assert.deepStrictEqual(pieces, ["Hmm."]);
      assert.strictEqual((error as ClaudeError).problem, "declined");
    });
  });

  describe("pasting her key", () => {
    it("asks again for nothing, or a key with a space in it", () => {
      assert.strictEqual(keyInputProblem(""), "Paste your key, or press Escape to stop.");
      assert.strictEqual(keyInputProblem("   "), "Paste your key, or press Escape to stop.");
      assert.strictEqual(keyInputProblem("sk-ant-api03 abc"), "That has a space in it. Could you paste it again?");
    });

    it("accepts a key with spaces around it, which pasting often adds", () => {
      assert.strictEqual(keyInputProblem(` ${KEY}\n`), undefined);
    });

    it("leaves deciding whether a key works to Claude", () => {
      assert.strictEqual(keyInputProblem("not-a-claude-looking-key"), undefined);
    });
  });

  describe("what she's told", () => {
    const told = (problem: ClaudeProblem) => {
      const error = toBrainError(new ClaudeError(problem));
      return [brainProblemMessages[error.problem], error.help && brainHelpButtons[error.help]];
    };
    const general = "Something went wrong while Mochi was thinking. Try again in a moment.";

    it("a rejected key offers to add a new one", () => {
      assert.deepStrictEqual(told("keyRejected"), [
        "Claude didn't accept your key. It may have been deleted in the Claude Console. Mochi: Add a Claude key sets a new one.",
        "Add a Claude key",
      ]);
    });

    it("billing, and the general line, open the Console", () => {
      assert.deepStrictEqual(told("billing"), [
        "Your Claude account may be out of credit. You can check in the Claude Console.",
        "Open the Claude Console",
      ]);
      // Low credit can come back as a plain 400.
      for (const problem of ["badRequest", "serverError", "other"] as const) {
        assert.deepStrictEqual(told(problem), [general, "Open the Claude Console"]);
      }
    });

    it("an answer that reached the limit offers to keep going", () => {
      assert.deepStrictEqual(told("cutOff"), ["That got long, so I stopped here. Want me to keep going?", "Keep going"]);
    });

    it("everything else is one line with no button", () => {
      assert.deepStrictEqual(told("rateLimited"), ["This brain is resting for now, maybe a usage limit. Try again a bit later.", undefined]);
      assert.deepStrictEqual(told("overloaded"), ["Claude is extra busy right now. Want to try again in a moment?", undefined]);
      assert.deepStrictEqual(told("notFound"), ["That Claude model isn't available anymore. Ask again and I'll help you pick another.", undefined]);
      assert.deepStrictEqual(told("tooLong"), ["That's a bit too much for me to send at once. Could you share a smaller piece?", undefined]);
      assert.deepStrictEqual(told("declined"), ["This brain chose not to answer that one. Want to ask it a different way?", undefined]);
      const offline = "I can't reach the brain right now. Are we offline? Everything else still works, and I'll be here when you're back.";
      assert.deepStrictEqual(told("offline"), [offline, undefined]);
      assert.deepStrictEqual(told("timeout"), [offline, undefined]);
    });

    it("never uses an em dash", () => {
      for (const line of [...Object.values(brainProblemMessages), ...Object.values(brainHelpButtons)]) {
        assert.ok(!line.includes("—"), line);
      }
    });
  });

  describe("an answer that goes quiet", () => {
    // Sends each chunk after its delay, then stays open until stopped.
    function slowStream(call: Call, chunks: [number, string][], thenEnd: boolean, aborted: () => void): Response {
      return new Response(
        new ReadableStream({
          async start(controller) {
            call.signal?.addEventListener("abort", () => {
              aborted();
              controller.error(new DOMException("aborted", "AbortError"));
            });
            for (const [delay, text] of chunks) {
              await new Promise((done) => setTimeout(done, delay));
              if (call.signal?.aborted) {
                return;
              }
              controller.enqueue(new TextEncoder().encode(text));
            }
            if (thenEnd) {
              controller.close();
            }
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    }
    const ping = "event: ping\ndata: {\"type\": \"ping\"}\n\n";

    it("is stopped after the idle time, keeping what was written", async () => {
      let streamAborted = false;
      reply = (call) =>
        slowStream(call, [[0, [...start, delta("First bit")].map(sseEvent).join("")]], false, () => (streamAborted = true));
      const pieces: string[] = [];
      const error = await failure(async () => {
        for await (const piece of answer(connect(KEY), "m", "rules", "hello", undefined, 50)) {
          pieces.push(piece);
        }
      });
      assert.deepStrictEqual(pieces, ["First bit"]);
      assert.strictEqual((error as ClaudeError).problem, "timeout");
      assert.ok(streamAborted, "the request itself is stopped");
    });

    it("keeps going while Claude sends keep-alive pings, like while it thinks", async () => {
      reply = (call) =>
        slowStream(
          call,
          [
            [0, start.map(sseEvent).join("")],
            ...Array.from({ length: 6 }, (): [number, string] => [20, ping]),
            [20, [delta("Thought it through."), ...end()].map(sseEvent).join("")],
          ],
          true,
          () => undefined
        );
      const pieces = await collect(answer(connect(KEY), "m", "rules", "hello", undefined, 50));
      assert.deepStrictEqual(pieces, ["Thought it through."]);
    });
  });

  describe("waiting and stopping", () => {
    it("gives up when no answer starts in time", async () => {
      reply = (call) =>
        new Promise((_resolve, reject) =>
          call.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        );
      const error = await failure(() =>
        collect(answer(connect(KEY, { timeoutMs: 20, maxRetries: 0 }), "m", "rules", "hello"))
      );
      assert.strictEqual((error as ClaudeError).problem, "timeout");
    });

    it("stops quietly when she stops the answer, keeping what was written", async () => {
      let streamAborted = false;
      reply = (call) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode([...start, delta("First bit")].map(sseEvent).join("")));
              // Then nothing more, until the request is stopped.
              call.signal?.addEventListener("abort", () => {
                streamAborted = true;
                controller.error(new DOMException("aborted", "AbortError"));
              });
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } }
        );
      const stop = new AbortController();
      const pieces: string[] = [];
      for await (const piece of answer(connect(KEY), "m", "rules", "hello", stop.signal)) {
        pieces.push(piece);
        stop.abort();
      }
      assert.deepStrictEqual(pieces, ["First bit"]);
      assert.ok(streamAborted, "the request itself is stopped");
    });
  });

  describe("an answer that reaches the limit", () => {
    it("keeps what was written, then says it was cut off", async () => {
      reply = () => stream([...start, delta("A long first part"), ...end("max_tokens")]);
      const pieces: string[] = [];
      const error = await failure(async () => {
        for await (const piece of answer(connect(KEY), "m", "rules", "explain everything")) {
          pieces.push(piece);
        }
      });
      assert.deepStrictEqual(pieces, ["A long first part"]);
      assert.strictEqual((error as ClaudeError).problem, "cutOff");
    });

    it("keeps going: her message, the answer so far, then a turn asking to continue", async () => {
      reply = () => stream([...start, delta(" and the rest."), ...end()]);
      const pieces = await collect(
        answer(connect(KEY), "m", "rules", "explain everything", undefined, undefined, "A long first part")
      );
      assert.deepStrictEqual(pieces, [" and the rest."]);
      assert.deepStrictEqual((calls[0].body as { messages: unknown }).messages, [
        { role: "user", content: "explain everything" },
        { role: "assistant", content: "A long first part" },
        { role: "user", content: KEEP_GOING },
      ]);
    });

    it("asks again when nothing was written yet, like a model that thought until the limit", () => {
      assert.deepStrictEqual(conversationFor("explain everything", ""), [{ role: "user", content: "explain everything" }]);
    });
  });

  describe("answers", () => {
    it("streams the answer, with Mochi's rules as the system prompt", async () => {
      reply = () => stream([...start, delta("A list is "), delta("a cozy collection."), ...end()]);
      const pieces = await collect(answer(connect(KEY), "claude-haiku-4-5", "Mochi's rules", "what's a list?"));
      assert.deepStrictEqual(pieces, ["A list is ", "a cozy collection."]);
      assert.deepStrictEqual(calls[0].body, {
        model: "claude-haiku-4-5",
        max_tokens: MAX_ANSWER_TOKENS,
        system: "Mochi's rules",
        messages: [{ role: "user", content: "what's a list?" }],
        stream: true,
      });
    });
  });

  describe("the model listing", () => {
    it("reads every page, newest first, leaving out retired and deprecated models", async () => {
      reply = (call) =>
        call.url.searchParams.get("after_id") === "claude-sonnet-5-5"
          ? json(200, {
              data: [model("claude-haiku-4-5-20251001", "Claude Haiku 4.5"), model("claude-3-haiku-20240307", "Claude Haiku 3", "retired")],
              has_more: false,
              first_id: "claude-haiku-4-5-20251001",
              last_id: "claude-3-haiku-20240307",
            })
          : json(200, {
              data: [model("claude-fable-5-1", "Claude Fable 5.1"), model("claude-opus-4-1", "Claude Opus 4.1", "deprecated"), model("claude-sonnet-5-5", "Claude Sonnet 5.5")],
              has_more: true,
              first_id: "claude-fable-5-1",
              last_id: "claude-sonnet-5-5",
            });
      const listing = await listModels(connect(KEY));
      assert.deepStrictEqual(listing, {
        ok: true,
        models: [
          { id: "claude-fable-5-1", name: "Claude Fable 5.1", maxInputTokens: 200_000 },
          { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", maxInputTokens: 200_000 },
          { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", maxInputTokens: 200_000 },
        ],
      });
      assert.strictEqual(calls.length, 2);
    });

    it("reads a saved listing back, ignoring anything that isn't one", () => {
      assert.deepStrictEqual(
        toSavedModels([
          { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", maxInputTokens: 200_000 },
          { id: "claude-new", name: "Claude New", maxInputTokens: null },
          { id: 42, name: "Not a model" },
          "claude-sonnet-5-5",
          null,
        ]),
        [
          { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", maxInputTokens: 200_000 },
          { id: "claude-new", name: "Claude New", maxInputTokens: null },
        ]
      );
      for (const value of [undefined, null, "list", {}, 7]) {
        assert.deepStrictEqual(toSavedModels(value), []);
      }
    });

    it("an empty listing is still a listing", async () => {
      assert.deepStrictEqual(await listModels(connect(KEY)), { ok: true, models: [] });
    });

    it("puts the starting point first, then keeps Claude's order", () => {
      const listed = [
        { id: "claude-fable-5-1", name: "Claude Fable 5.1", maxInputTokens: null },
        { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", maxInputTokens: null },
        { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", maxInputTokens: null },
      ];
      assert.deepStrictEqual(
        startingPointFirst(listed).map((model) => model.name),
        ["Claude Haiku 4.5", "Claude Fable 5.1", "Claude Sonnet 5.5"]
      );
      // No mark when it isn't listed, and nothing fails.
      assert.deepStrictEqual(startingPointFirst(listed.slice(0, 2)), listed.slice(0, 2));
    });

    it("marks the starting point, by name or dated", () => {
      assert.ok(isStartingPoint("claude-haiku-4-5"));
      assert.ok(isStartingPoint("claude-haiku-4-5-20251001"));
      assert.ok(!isStartingPoint("claude-haiku-4-5-turbo"));
      assert.ok(!isStartingPoint("claude-sonnet-5-5"));
    });
  });
});
