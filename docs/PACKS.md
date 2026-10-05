# Packs

A pack gives Mochi its personality: its name, how it talks, and the lines it
says in each moment. The extension is the engine; packs are the soul. The code
that checks packs is `src/packs/format.ts`.

## Layers
- **Default pack:** ships with Mochi, for everyone. It sets everything.
- **Personal layer:** sits on top of the default pack. It sets only what it
  wants to change, and everything else falls back to the default. For
  phrases, a moment's whole list is replaced, so her own lines never mix with
  the default ones.

## pack.json, format 1

```json
{
  "format": 1,
  "name": "Mochi",
  "voice": {
    "personality": "Playful, warm, and a little bit cat."
  },
  "phrases": {
    "greeting": ["Good {timeOfDay}! What are we making?", "Good {timeOfDay}, {name}!"],
    "greetingLate": ["Hi, night owl!"],
    "stuck": ["Want me to take a look?"],
    "lateNight": ["It's getting late. Want me to dim things with a darker theme?"],
    "celebrate": ["Yay, you finished {thing}!"]
  },
  "user": {
    "name": "Sam"
  }
}
```

| Field | What it is | Limit |
|---|---|---|
| `format` | Always `1` for now | |
| `name` | What the companion is called, on one line | 30 characters |
| `voice.personality` | How the companion talks. Later, this guides the AI | 2000 characters |
| `phrases.<moment>` | Lines for a moment. Mochi picks one | 1 to 20 phrases, 200 characters each |
| `user.name` | Her name, on one line. Optional, and only for the personal layer; the default pack never sets it | 30 characters |

The moments are `greeting`, `greetingLate`, `stuck`, `lateNight`,
`lateNightCompany`, and `celebrate` (see MOMENTS.md). `greetingLate` replaces
`greeting` after the late-night hour, because "Good night" sounds like
goodbye. `lateNight` lines offer a darker theme; `lateNightCompany` lines only
keep her company, for themes that are already dark or high contrast. Art for the moods
comes in a later format, with MOCHI-17.

## Placeholders
Phrases can use these, filled in when Mochi speaks:

| Placeholder | Means | Allowed in |
|---|---|---|
| `{companion}` | The companion's name | Every moment |
| `{name}` | Her name, from `user.name` | `greeting`, `greetingLate` |
| `{timeOfDay}` | morning, afternoon, or evening, never night | `greeting` |
| `{thing}` | What she finished | `celebrate` |

A phrase with `{name}` is only picked when a name is set, so every moment
needs at least one phrase without it.

## Packs are checked strictly
Packs can come from other people, like a gift file, so Mochi checks every pack
before using it, and rejects it with a plain-English reason if:
- it has any field not listed above, at any level
- `format` isn't `1`
- any text is empty, too long, or contains hidden control characters
- `name` is more than one line
- a moment has no phrases or more than 20
- a phrase uses a placeholder its moment can't use
- every phrase of a moment uses `{name}`

A pack can only change how Mochi looks and talks. It can never change
settings, the AI choice, or API keys, and never runs anything (see
ARCHITECTURE.md).
