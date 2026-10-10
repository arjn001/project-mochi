# Chat

How talking to Mochi works: where the brain comes from, what a conversation
holds, what's sent, learning mode, and what Mochi says when things go wrong.
This is behavior only. How the chat looks (layout, colors, the avatar) comes
from DESIGN.md (MOCHI-50). The panel is built first with VS Code's theme
only, and its look is added later.

Checked against the tools and docs as of 2026-10-06. Sources are at the end.

## 1. Where the brain comes from

Mochi uses whatever brain she already has, in this order of preference. It
never ships its own key and has no server of its own (DECISIONS.md).

| She has... | What Mochi does | Cost to her |
|---|---|---|
| **Copilot, signed in** | Uses it through VS Code's built-in AI. VS Code asks once, "Allow Mochi to use Copilot?", the first time she asks something. That's the only step. | Her Copilot plan: every chat message spends GitHub AI Credits, on every plan, including Free and Student (which get Auto only). Mochi only spends them when she asks. |
| **A model from another extension** (like the Ollama extension or AI Toolkit for local models) | Shows up in Mochi's brain list automatically, through the same built-in AI. No key in Mochi. | Whatever that extension costs; local models are free. |
| **ChatGPT Plus or Claude Pro/Max** | Explains honestly: "Your subscription works in ChatGPT or Claude's own apps, but they don't let other apps use it. You can sign in to Copilot, which uses your Copilot plan, or use an API key." Then offers both. | Nothing extra unless she picks an API key. |
| **Her own API key** (Claude, MOCHI-53; OpenAI-compatible, MOCHI-54) | "Get a key" opens the provider's website in her browser. She pastes the key, and Mochi keeps it in VS Code's secret storage (her system keychain), never in settings or files. Mochi says clearly that each answer is billed to her account, per use. How the Claude key works is in "Her own Claude key" below. | Pay per use, billed by the provider. Separate from any subscription. |
| **A local model server** (Ollama, LM Studio) without an extension | Through MOCHI-54: an OpenAI-compatible address like `http://localhost:11434/v1` (Ollama) or `http://localhost:1234/v1` (LM Studio), with no key. Works offline. | Free, runs on her computer. |
| **Nothing** | Everything that doesn't need a brain still works: greetings, late-night company, quiet mode, the focus timer, the theme, Python setup, "Need a paw?" hints. When she asks something, one gentle line: "I'd need a brain to answer that. Want to set one up?" | Nothing. |

**Why a subscription can't be used:** Anthropic's terms (clarified on
2026-02-19) say logins from Claude Free, Pro, or Max may only be used in
Anthropic's own apps; any other app must use an API key. ChatGPT Plus doesn't
include API access either. So Mochi never asks for her Claude or ChatGPT
login, and never borrows Claude Code's.

## 2. Keys Mochi stores vs. models VS Code already has (checked first)

**The question:** if she adds a model through VS Code's own model management
("Chat: Manage Language Models", bring your own key), can Mochi use it? If
so, Mochi should prefer that over storing keys itself.

**What I found:**
- **Models contributed by extensions: yes.** VS Code's Language Model API
  lets any extension register a model provider
  (`registerLanguageModelChatProvider`, in the stable API since before our
  oldest supported version, 1.125). `vscode.lm.selectChatModels()` with no
  filter "returns all chat models", and the docs say any extension can send
  requests to those models. So Copilot models, and models from extensions
  like Ollama's or AI Toolkit, should reach Mochi with no key in Mochi
  (confirmed per extension with the dev menu list below).
- **Keys typed into VS Code's own "Manage Models" screen: no, not reliably.**
  VS Code's docs describe these for its Chat view only and never say other
  extensions can use them. A model-provider extension's README states the
  built-in Anthropic key "only allows using Claude models from the Chat
  sidebar", and trying from another extension fails.
- **To confirm on a real machine:** before building MOCHI-53, a "List
  available brains" item in the Mochi dev menu shows exactly what Mochi can
  see on Arjun's normal profile, with Copilot and with a key added in Manage
  Models.

**So:** Mochi prefers anything in VS Code's built-in AI (Copilot and
extension models), with no key stored in Mochi. For people who only have an
API key, Mochi keeps it itself in secret storage (MOCHI-53, MOCHI-54). If a
later VS Code version shares "Manage Models" keys with extensions, Mochi
switches to that and stops asking for keys.

### Her own Claude key (MOCHI-53, part 2)

**Adding it.** "Mochi: Add a Claude key" opens a dialog that says plainly
it's billed per use, that a Claude Pro or Max subscription can't be used
here, and "Tip: you can set a monthly spend limit in the Claude Console."
"Get a key" opens the Claude Console's keys page. She pastes the key into a
hidden box that stays open while she copies it. Mochi checks it with the
Claude API's model listing, which is free (no answer, no cost), and only
then saves it. A key that doesn't work is never saved. If the computer has
no keychain Mochi can use (it happens on Linux), Mochi says so, keeps
nothing, and links VS Code's page on fixing it.

**Choosing the model.** It's her key and her bill, so she chooses. Right
after the key checks out, "Which Claude model should Mochi use?" lists
every current model the listing returns, Fable 5.1 included, each marked
"your key · billed per use". No prices in Mochi, and nothing hidden by
price. Retired models can't answer and deprecated ones are closed to new
keys, so neither is shown. "Good starting point for explanations" marks
`claude-haiku-4-5` (or its dated id), kept in one place
(`STARTING_POINT` in `src/ai/claude.ts`); if it isn't listed, there's no
mark. There's no silent default: if she closes the list, the key is still
saved, Copilot's Auto keeps answering if she has it, and otherwise Part 1's
list comes up when she asks. Her Claude models also appear in "Mochi:
Choose a brain", and it offers "Add a Claude key" while there's none.

**Answers.** Mochi's rules go in the system prompt, answers stream, and
each answer is capped at 4,000 tokens, plenty for an explanation and safe
for her bill. Mochi waits 30 seconds for an answer to start (with one
retry), and stops an answer that goes silent for 30 seconds, keeping what
was written. Anything Claude sends counts, down to its keep-alive pings, so
a model that's still thinking isn't cut off. When a model refuses, Mochi
says so kindly and doesn't retry with another model, since that would bill
a model she didn't pick.

**Keep going** (MOCHI-67). An answer that reaches the 4,000-token limit
keeps what was written, then Mochi says "That got long, so I stopped here.
Want me to keep going?" with "Keep going". That sends the same approved
request, the answer so far, and a short turn asking Claude to continue
without repeating (newer models reject a request that ends on their own
words), and the rest joins the same answer. Nothing new is shared, so
there's no share-gate question. It can be offered again, and each click is
billed. If a thinking model used the whole limit before writing anything,
"Keep going" asks her question again. **Claude-key brains only:** VS Code's
language model API (checked against `@types/vscode` 1.125, 2026-10-09)
streams only the text and never says why an answer ended, so Mochi can't
tell when a Copilot answer was cut off.

**Which models exist, over time.** The listing is asked again after 10
minutes, when she opens a list, and when a model isn't found. The last
listing that worked is kept (model ids and names only), so a moment offline
doesn't make her pick look gone. If her saved model is retired, her next
question gets Part 1's stand-in note with Auto, or the list.

**Where her key goes.** Only to `https://api.anthropic.com`, through the
official Claude SDK (`@anthropic-ai/sdk`, MIT). A cloned project or a dev
container can set environment variables, so nothing from them is used:
the address, key, logging, and timeouts are all set by Mochi, so
`ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`,
`ANTHROPIC_LOG`, and the profile settings change nothing. Every request is
also checked on its way out: it must go to that address, it carries her
key, and any header not on a short list is dropped (this stops
`ANTHROPIC_CUSTOM_HEADERS`, which the SDK would otherwise add after her
key). The key is never logged and never part of an error. Unit tests set
these variables and check all of it.

**Remote setups and proxies** (checked 2026-10-07):
- VS Code's secret storage always keeps secrets on her own computer, even
  in Remote SSH, WSL, and dev containers.
- In a remote setup, Mochi runs on the remote machine, so the key passes
  through that machine's memory when Mochi makes the call there.
- VS Code 1.125's extension host patches the global `fetch` to follow VS
  Code's proxy settings, through `http.fetchAdditionalSupport` (on by
  default; off means no proxy). Mochi reads `fetch` at the moment of each
  call, so it always gets the patched one.
- Codespaces in a browser is unverified.

**Removing it.** "Mochi: Remove my Claude key" asks first, then forgets the
key, the saved list of her Claude models, and her pick if it was a Claude
model. It only shows in the Command Palette while a key is saved.

## 3. The conversation

**One per project, kept on her computer.**
- Each project (workspace) has its own conversation, kept in Mochi's private
  storage on her own computer (even when she works over SSH, in WSL, or in a
  container). Opening the project again brings it back.
- No folder open: the conversation lasts until VS Code closes.
- Never synced, never sent anywhere except to the brain she picked, and
  only when she sends a message.
- **Up to 200 messages are kept** per project; older ones fall off quietly.
  Mochi keeps the conversations of the 20 projects she used most recently.
- **The history can include code.** Code she pastes into a message, and
  code the brain quotes in its replies, is part of the conversation, so it's
  saved with it. Mochi says so plainly in the chat's empty state: "Our chat
  stays on this computer. It can include code from our conversation; Clear
  chat removes it."
- **"Clear chat"** empties this project's conversation, after asking:
  "Clear this chat? This can't be undone." with "Clear" and "Keep it".
- **"Mochi: Forget everything"** clears every conversation in every project,
  her personal layer, and everything Mochi remembers about her days (see
  DECISIONS.md, "What Mochi keeps"), after asking in a dialog:
  "Forget everything?" with "This clears your chats, your name and personal
  touches, and everything Mochi remembers about your days. Your settings and
  any saved AI key stay as they are." and "Forget everything" or "Keep it".

**What's sent, and nothing more.**
- What she types, plus what she attaches, plus **only the recent messages**
  of this conversation, so the brain can follow along. They're picked
  newest first within a size budget (a few thousand words, and always within
  the brain's own limit). The rest stays in the history on her computer but
  isn't sent. This keeps answers fast and protects her quota or her bill.
- Mochi never reads her files, screen, or terminal on its own.
- **Attachments show as chips** above the box, naming the file and lines:
  `homework.py, lines 9 to 15`. Each has an x to remove it before sending.
  Adding one goes through the share gate, which names the brain ("Share
  lines 9 to 15 of homework.py with Copilot?"). `.env` and key files are
  never attached, and text that looks like a password or API key gets a
  warning first.
- **The same warning for what she types:** if she pastes something that
  looks like an API key or password, Mochi asks before sending: "Careful:
  this looks like it might contain a password or API key. Send anyway?"
- **Attachments aren't saved with the history.** The chat keeps the chip
  ("shared lines 9 to 15 of homework.py"), but the attached code itself is
  kept only until VS Code closes. After a restart, the brain no longer sees
  it; she can attach it again. (Code that appears in messages is saved, as
  above.)

**The brain at the top.** The chat header shows the current brain, like
"Copilot · Auto". One click opens "Which brain should Mochi think with?":
"Let Mochi choose" (with its current pick, like "Now: Copilot · Auto"),
then every brain Mochi can see, with "Uses your Copilot plan" as a quiet
line, and the one in use marked. Until the panel exists, "Mochi: Choose a
brain" opens the same list (MOCHI-53).
- **Which brain:** her pick (the `mochi.brain` setting), otherwise Copilot's
  Auto. Mochi never picks another model without her. With no Auto and no
  pick, it shows the list when she asks; if she closes it, Mochi answers
  with one line, "I'll think once you pick a brain. Mochi: Choose a brain
  whenever you're ready.", and asks again next time.
- **If her pick disappears** (signed out, extension removed, another
  machine), Auto stands in, and the top of her next answer says so, once
  per change: "Quick note: GPT-5.6 Luna isn't available right now, so I'm
  thinking with Copilot · Auto instead. Mochi: Choose a brain changes this."
- **Billing:** every Copilot chat message uses her plan's AI credits. Mochi
  keeps no price table, since prices change; it only thinks when she asks,
  and only sends recent messages within a size budget.

**While Mochi answers.**
- **Streaming:** the answer appears as it's written (MOCHI-25).
- **Stop:** a Stop button (and Escape) ends it right away; what's there
  stays, marked "Stopped".
- **Code blocks:** shown as code, with the language's colors, and a **Copy**
  button on each. Copy only copies; it never runs or inserts anything.
- **The answer is untrusted text.** It's shown as Markdown with HTML turned
  off, and links never run commands. The panel has a strict content
  security policy.

**Two rules for every brain.**
- **Mochi never calls the AI on its own.** Only her message, or her click
  (like "Explain with Mochi"), starts an AI request. Never for greetings,
  nudges, hints, or anything in the background. Her quota and her code are
  only spent when she decides.
- **Nothing in a reply can make Mochi act.** A reply is text. If it suggests
  something Mochi can do (switch to a dark theme, set up Python, any future
  action), that needs her click, through the same "asks first, then Undo"
  flow as everything else (MOCHI-31). Mochi never reads a reply for commands to run.
- **Attached code is untrusted, too.** A file can contain text aimed at the
  AI ("ignore your rules and..."). Mochi's rules come from code and always
  have the last word, the share gate and actions are enforced in code, and
  no reply can trigger anything, so such text can't do more than confuse an
  answer (see ARCHITECTURE.md).

## 4. Learning mode

A setting, **on by default**: "Learning mode: help me learn instead of
handing me answers."
- **On:** for coursework-style requests (homework, assignments, "fix my
  code", errors), Mochi follows the learning ladder: explain first (what it
  means, why, where to look), then a hint if she asks, and the fix only when
  she explicitly asks, as the smallest change plus why. Whole assignments
  get a warm "let's do it together", never a cold refusal. Everyday
  questions ("what's a list?") get a normal answer.
- **Off:** direct answers, including fixes, for when she just needs it
  working.
- **Only she can change it.** It's an application-level setting, so a
  project's `.vscode/settings.json` can't switch it off. Packs and gifts
  can't touch settings at all. The ladder text lives in Mochi's code, next
  to the other fixed rules, and is added or left out by the setting.
- Explaining an error from the lightbulb (MOCHI-30) follows the same
  setting: off means it offers the fix right away.

## 5. When things go wrong

Every failure gets one kind line, from the pack (so her personal layer can
reword them), and never a raw error. Each one says what she can do.

| What happened | What Mochi says (default pack) | What she can do |
|---|---|---|
| **No brain connected** | "I'd need a brain to answer that. Want to set one up?" | "Set one up" |
| **Quota or usage limit reached** | "This brain is resting for now, maybe a usage limit. Want to try another one, or ask again a bit later?" | "Switch brain" |
| **Offline** | "I can't reach the brain right now. Are we offline? Everything else still works, and I'll be here when you're back." | "Try again" |
| **The brain's own error** | "Something went wrong while I was thinking. Want to try that again?" | "Try again" |
| **She hasn't allowed Copilot yet** | "I need your OK to use Copilot. Ask again and choose Allow." | Ask again |

**With her own Claude key**, each problem maps to one line (in
`src/ai/claude.ts`, from `src/strings.ts`). Mochi never matches error text,
so low credit that comes back as a plain 400 gets the general line, and
that line offers the Console too.

| What the Claude API says | What Mochi says | Button |
|---|---|---|
| 401 or 403: the key doesn't work | "Claude didn't accept your key. It may have been deleted in the Claude Console. Mochi: Add a Claude key sets a new one." | "Add a Claude key" |
| 402: billing | "Your Claude account may be out of credit. You can check in the Claude Console." | "Open the Claude Console" (Billing) |
| 429: a rate limit | "This brain is resting for now, maybe a usage limit. Try again a bit later." | |
| 529, or "overloaded" mid-answer | "Claude is extra busy right now. Want to try again in a moment?" | |
| 404: the model is gone | "That Claude model isn't available anymore. Ask again and I'll help you pick another." | |
| 413: too much to send | "That's a bit too much for me to send at once. Could you share a smaller piece?" | |
| No connection, no answer within 30 seconds, or 30 seconds of silence | "I can't reach the brain right now. Are we offline? Everything else still works, and I'll be here when you're back." | |
| A refusal | "This brain chose not to answer that one. Want to ask it a different way?" | |
| The 4,000-token limit (`max_tokens`) | "That got long, so I stopped here. Want me to keep going?" (a gentle note, not a warning) | "Keep going" |
| Other 400s, 500s, anything else | "Something went wrong while Mochi was thinking. Try again in a moment." | "Open the Claude Console" (Billing) |

Stopping an answer says nothing; what was written stays. Copilot's lines
have no buttons.

What she typed is never lost: a failed message stays in the box, ready to
send again.

## 6. The planning checklist

**Her journeys**
- *First time, no brain:* the chat works as a place to type; sending shows
  the "no brain" line with "Set one up".
- *Copilot installed but not allowed yet:* the first message triggers VS
  Code's one-time Allow; saying no shows the "needs your OK" line.
- *Quiet mode:* the chat always answers when she asks. Quiet only stops
  Mochi starting things.
- *Focus session running:* chat works as normal; she started it.
- *Untrusted folder (Restricted Mode):* chat works; attachments still go
  through the share gate. Nothing is run.
- *Single file, no folder:* chat works; the conversation lasts the session.

**Changes over time**
- Brains come and go (signed out, an extension added): Mochi listens for
  VS Code's "models changed" event and updates the list and the header.
- Learning mode changes take effect on the next message.
- Her personal layer's style notes apply on the next message.

**Other setups**
- *Windows, macOS, Linux:* the same everywhere. Keys go into each system's
  keychain through VS Code's secret storage.
- *Remote (SSH, WSL, containers, Codespaces):* the built-in AI and secret
  storage work there; keys stay on her own computer. Direct API calls
  (MOCHI-53/54) run where Mochi runs, so a local model on her laptop isn't
  reachable from a remote machine; Mochi says so plainly if the address
  can't be reached.
- *VS Code for the Web:* not supported in version 1 (DECISIONS.md).
- *Multi-root workspaces:* one conversation for the whole workspace.
- *Other editors (VSCodium, Cursor, and others from Open VSX):* Copilot may
  not exist, and the built-in AI list may be empty. The API key and local
  model options (MOCHI-53/54) are how Mochi works there.
- *No AI, offline, restricted networks:* see section 1 and 5. Direct API
  calls follow VS Code's proxy settings (see "Her own Claude key"). With no
  Copilot setup in the editor, "Set one up" opens Choose a brain, which
  offers "Add a Claude key".
- *Screen readers:* new answers are announced politely when they finish,
  not word by word. Everything works from the keyboard: Enter sends,
  Shift+Enter adds a line, Escape stops, and focus stays in the box.
- *High contrast and themes:* the chat uses VS Code's theme colors only.
- *Other languages:* Mochi's own words live in the pack and `strings.ts`.
  The brain is asked to answer in the language she writes in.

**When it fails:** section 5. Never silence, never a raw error, and her
message is never lost.

**Fresh-user test:** a clean profile with no Copilot: open the chat, send
"hi", see the "no brain" line, click "Set one up". Then with Copilot: allow
once, ask "what's a list?", see it stream, stop one halfway, copy a code
block, restart VS Code, and find the conversation still there. Finally,
"Mochi: Forget everything", and see the chat, her name, and the greeting
memory gone.

## What this changes elsewhere
- **DECISIONS.md:** local models no longer wait for the next version; they
  come through VS Code's built-in AI (via their extensions) and through the
  OpenAI-compatible option (MOCHI-54).
- **The AI's fixed rules** (`src/ai/instructions.ts`): the ladder becomes
  conditional on Learning mode; the other rules stay always on.
- **DECISIONS.md:** what Mochi keeps on her computer (including that chat
  history can contain code), "Forget everything", and the two rules: Mochi
  never calls the AI on its own, and nothing in a reply can make it act.
- **ARCHITECTURE.md:** attached code is untrusted input that may contain
  instructions aimed at the AI.
- **Jira:** MOCHI-21, 22, 23, 25, 53, and 54 are updated to match, and
  Learning mode and "Forget everything" get their own tasks.

## Sources
- [VS Code: Language Model API](https://code.visualstudio.com/api/extension-guides/ai/language-model)
- [VS Code: Language Model Chat Provider API](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider)
- [VS Code: AI language models in VS Code (bring your own key)](https://code.visualstudio.com/docs/agent-customization/language-models)
- [VS Code blog: Use your own language model key in VS Code (2026-06-18)](https://code.visualstudio.com/blogs/2026/06/18/byok-vscode)
- [claude-model-provider README (built-in key only works in the Chat view)](https://github.com/cpulvermacher/claude-model-provider)
- [The Register: Anthropic clarifies ban on third-party tool access to Claude](https://www.theregister.com/software/2026/02/20/anthropic-clarifies-ban-on-third-party-tool-access-to-claude/5014546)
- `@types/vscode` 1.125: `vscode.lm.selectChatModels`, `registerLanguageModelChatProvider`
- [Claude API overview: keys page, billing and spend limits](https://platform.claude.com/docs/en/api/overview) (checked 2026-10-08)
- [Claude API rate limits and spend limits](https://platform.claude.com/docs/api/rate-limits)
- [VS Code: Troubleshoot credential-store issues](https://code.visualstudio.com/docs/configure/settings-sync#_troubleshoot-credential-store-issues) (checked 2026-10-09)
- `@anthropic-ai/sdk` 0.132.1: client options, the environment variables it reads, `models.list` with `lifecycle`, and its error classes, read from the package itself (2026-10-08)
