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

## Deferred, by design
- Messaging between people (notes, ask for help, Live Share). The architecture
  should leave room for it.
- A natural-language layer over any installed extension's commands. Version 1
  starts with a small set of hand-picked actions.
- Community packs.

## Presence
- Home on the right side, a status bar mood line when closed, gentle by
  default, a soft illustrated cat with moods.

## Process
- Jira space MOCHI: epic "User Stories" > stories > subtasks.
- Small, natural commits, one logical change each, starting with the Jira key.
- One branch per task, merged with a pull request.
