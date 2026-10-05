# Decisions

## Product
- Dropped the first prototype (a story-and-puzzles room in a tab). It felt like
  homework with nice wallpaper. The companion should live beside the work.
- Version 1 is a companion panel with AI chat, a few actions, and gentle
  reactions to key moments.
- Personalization works through packs: the extension is the engine, packs give
  it a personality (look, colors, voice, phrases). Version 1 ships two: a
  default pack and a private personal layer that never ships publicly.
- Settings are always editable through a "Make it yours" page.

## Name and ID
- Marketplace display name: "Mochi Companion". Plain "Mochi" is already taken
  by another AI coding extension.
- Publisher: `arjungyawali`, so Arjun is the author. This is also a portfolio
  project.
- Extension ID: `arjungyawali.mochi-companion`.
- Inside VS Code, the cat is still just called Mochi.
- Checked free on 2026-10-03: the display name, publisher, and ID on the VS
  Code Marketplace, and the `arjungyawali` namespace and ID on Open VSX. Mochi
  may be published on Open VSX too.

## AI
- Mochi asks where its AI comes from during the first-run welcome. It can be
  changed anytime on the "Make it yours" page.
- Version 1 options:
  - VS Code's built-in AI, through her Copilot sign-in. Picked automatically
    when available, no key needed. This is the default.
  - Claude, with her own API key.
  - Any OpenAI-compatible service, with an API key and an address. This
    covers ChatGPT.
- All options sit behind one provider layer, so Mochi's personality comes from
  the pack, not from whichever AI answers.
- API keys live in VS Code's secret storage, never in settings files or the
  repo.
- Asking to share code always names where it goes ("Share this error with
  Claude?").
- The welcome explains that a ChatGPT or Claude subscription is not an API
  key. API keys are billed separately per use.
- Local models (like Ollama) wait for the next version, since most people
  don't have one set up.

## Deferred, by design
- Messaging between people (notes, ask for help, Live Share). The architecture
  should leave room for it.
- A natural-language layer over any installed extension's commands. Version 1
  starts with a small set of hand-picked actions.
- Community packs.

## Presence
- Home on the right side, a status bar mood line when closed, gentle by
  default, a soft illustrated cat with moods.
- Two more places from the first sketch: a hint inside the code next to
  errors, and a gentle corner nudge for key moments. Both stay silent in
  quiet mode.

## Building and packaging
- Mochi is packaged into a `.vsix` with `npm run package`. Source code
  (`src/`) and compiled tests (`out/test/`) never go into the package, and CI
  fails if they do.
- No bundling yet (decided in MOCHI-14). Mochi has no runtime dependencies, so
  the TypeScript compiler alone is enough. esbuild bundling gets added with
  the first runtime dependency, most likely in MOCHI-22 or MOCHI-53.
- No license yet. Mochi is packaged with `--skip-license` until one is chosen
  before going public (MOCHI-59). Leaning: MIT for the code, with Mochi's
  name, icons, and art all rights reserved.

## Process
- Jira space MOCHI: each category is a "User Stories" epic with its user
  story in the description, and Tasks under it.
- Small, natural commits, one logical change each, starting with the Jira key.
- One branch per task, merged with a pull request.
- Branches are kept after merging, never deleted.
