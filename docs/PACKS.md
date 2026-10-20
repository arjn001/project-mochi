# Packs

A pack gives Mochi its personality: its name, how it talks, and the lines it
says in each moment. The extension is the engine; packs are the soul. The code
that checks packs is `src/packs/format.ts`.

## Layers
- **Default pack:** ships with Mochi, for everyone. It sets everything.
- **Personal layer:** sits on top of the default pack. It sets only what it
  wants to change, and everything else falls back to the default. For
  phrases, a moment's whole list is replaced, so her own lines never mix with
  the default ones. It can add style notes (`voice.style`) but never replace
  the personality, since a gift becomes this layer (see ARCHITECTURE.md,
  "The voice is untrusted").

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
| `voice.personality` | How the companion talks; guides the AI. Only complete packs that ship with Mochi; a personal layer or gift can't set it | 2000 characters |
| `voice.style` | Tone and style notes from a personal layer, sent to the AI as quoted data, never as instructions | 400 characters |
| `phrases.<moment>` | Lines for a moment. Mochi picks one | 1 to 20 phrases, 200 characters each |
| `user.name` | Her name, on one line. Optional, and only for the personal layer; the default pack never sets it | 30 characters |

The moments are `greeting`, `greetingLate`, `welcomeBack`, `backToProject`,
`stuck`, `lateNight`, `lateNightCompany`, `celebrate`, and `celebrateDone`
(see MOMENTS.md). `celebrateDone` is for when she finished something but
there's nothing to name, like "It finally works!".
`greetingLate` replaces `greeting` after the late-night hour, because "Good
night" sounds like goodbye. `welcomeBack` follows the greeting after 2 or more
days away, and never counts them; `backToProject` follows it when she opens
the project she last coded in. `lateNight` lines offer a darker theme;
`lateNightCompany` lines only keep her company, for themes that are already
dark or high contrast. Art for the moods comes in a later format, with
MOCHI-17.

A personal layer sets only what it changes:

```json
{
  "format": 1,
  "voice": { "style": "Extra sleepy, loves puns." },
  "phrases": { "stuck": ["Need a paw, {companion} is here."] },
  "user": { "name": "Sam" }
}
```

## Placeholders
Phrases can use these, filled in when Mochi speaks:

| Placeholder | Means | Allowed in |
|---|---|---|
| `{companion}` | The companion's name | Every moment |
| `{name}` | Her name, from `user.name` | `greeting`, `greetingLate` |
| `{timeOfDay}` | morning, afternoon, or evening, never night | `greeting` |
| `{thing}` | What she finished | `celebrate` |
| `{project}` | The project she's opening again, by folder name | `backToProject` |

A phrase with `{name}` is only picked when a name is set, so every moment
needs at least one phrase without it. Placeholders are filled in once, as
plain text: a name like "{thing}" shows up exactly as typed.

## Packs are checked strictly
Packs can come from other people, like a gift file, so Mochi checks every pack
before using it, and rejects it with a plain-English reason if:
- it has any field not listed above, at any level
- `format` isn't `1`
- any text is empty, too long, or contains hidden control characters or
  invisible characters that change the direction of the text
- a personal layer or gift sets `voice.personality`
- `name` is more than one line
- a moment has no phrases or more than 20
- a phrase uses a placeholder its moment can't use
- every phrase of a moment uses `{name}`

A pack can only change how Mochi looks and talks. It can never change
settings, the AI choice, or API keys, and never runs anything (see
ARCHITECTURE.md).

## The gift file, format 1
A gift is a personal layer made for someone else, saved as one
`.mochigift` file (MOCHI-55). It's plain JSON text in UTF-8, with Unix line
endings, never a zip, so there's nothing to unpack. The code is
`src/packs/gift.ts`.

```json
{
  "mochigift": 1,
  "from": "Alex",
  "note": "Happy birthday! Mochi is all yours.",
  "layer": {
    "format": 1,
    "voice": { "style": "Extra sleepy, loves puns." },
    "phrases": { "stuck": ["Need a paw? I'm right here."] },
    "user": { "name": "Sam" }
  }
}
```

| Field | What it is | Limit |
|---|---|---|
| `mochigift` | Always `1` for now | |
| `from` | Optional. Who made it, as she knows them, on one line | 30 characters |
| `note` | Optional. A note for her, shown when she unwraps it | 300 characters |
| `layer` | A personal layer, checked exactly like her own | See above |

- `from` and `note` are only for the "You've got a gift!" screen
  (MOCHI-56). They're never sent to the AI and never become part of her
  voice.
- A gift must set at least one thing: a name, a style note, or some lines.
- It's checked as strictly as a pack: unknown fields anywhere are
  rejected, the same text checks apply, and the layer can't set
  `voice.personality`.
- The writer copies only the fields a layer may have, then checks the
  result, so Mochi never saves a gift it wouldn't unwrap, and nothing else
  (a setting, the brain, a key, a chat) can end up in the file.
- Art comes in a later format, with MOCHI-17: images inside the same JSON,
  PNG, JPEG, or WebP only, checked and size-limited (see ARCHITECTURE.md).
