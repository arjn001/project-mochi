// The pack format: what a pack.json may contain, and how layers combine.
// Plain code with no VS Code dependency. See docs/PACKS.md.
//
// Packs can come from strangers (gift files, later community packs), so
// checking is strict: unknown fields are rejected, every text has a length
// limit, and phrases may only use known placeholders.

export const PACK_FORMAT = 1;

// The moments Mochi has lines for (see MOMENTS.md).
export const MOMENTS = ["greeting", "stuck", "lateNight", "celebrate"] as const;
export type Moment = (typeof MOMENTS)[number];

// Placeholders a phrase may use, per moment. {name} works everywhere.
const PLACEHOLDERS: Record<Moment, readonly string[]> = {
  greeting: ["name", "timeOfDay"],
  stuck: ["name"],
  lateNight: ["name"],
  celebrate: ["name", "thing"],
};

export const LIMITS = {
  name: 30,
  personality: 2000,
  phrase: 200,
  phrasesPerMoment: 20,
};

// A complete pack, like the default pack. Every moment has lines.
export interface Pack {
  format: typeof PACK_FORMAT;
  name: string;
  voice: { personality: string };
  phrases: Record<Moment, string[]>;
}

// A layer, like the personal layer. Anything left out falls back to the pack
// underneath it.
export interface PackLayer {
  format: typeof PACK_FORMAT;
  name?: string;
  voice?: { personality?: string };
  phrases?: Partial<Record<Moment, string[]>>;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function onlyKeys(obj: Record<string, unknown>, allowed: readonly string[], where: string, errors: string[]): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push(`${where} has an unknown field "${key}".`);
    }
  }
}

function checkText(value: unknown, max: number, where: string, errors: string[]): void {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${where} must be some text.`);
  } else if (value.length > max) {
    errors.push(`${where} is ${value.length} characters, more than the ${max} allowed.`);
  } else if (/[\u0000-\u0008\u000B-\u001F\u007F]/.test(value)) {
    errors.push(`${where} contains hidden control characters.`);
  }
}

// Checks a layer. Use checkPack for something that must be complete.
export function checkLayer(input: unknown): Checked<PackLayer> {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["A pack must be a JSON object."] };
  }
  onlyKeys(input, ["format", "name", "voice", "phrases"], "The pack", errors);

  if (input.format !== PACK_FORMAT) {
    errors.push(`"format" must be ${PACK_FORMAT}.`);
  }
  if (input.name !== undefined) {
    checkText(input.name, LIMITS.name, '"name"', errors);
    if (typeof input.name === "string" && input.name.includes("\n")) {
      errors.push('"name" must be one line.');
    }
  }
  if (input.voice !== undefined) {
    if (!isObject(input.voice)) {
      errors.push('"voice" must be an object.');
    } else {
      onlyKeys(input.voice, ["personality"], '"voice"', errors);
      if (input.voice.personality !== undefined) {
        checkText(input.voice.personality, LIMITS.personality, '"voice.personality"', errors);
      }
    }
  }
  if (input.phrases !== undefined) {
    if (!isObject(input.phrases)) {
      errors.push('"phrases" must be an object.');
    } else {
      onlyKeys(input.phrases, MOMENTS, '"phrases"', errors);
      for (const moment of MOMENTS) {
        const list = input.phrases[moment];
        if (list === undefined) {
          continue;
        }
        const where = `"phrases.${moment}"`;
        if (!Array.isArray(list) || list.length === 0) {
          errors.push(`${where} must be a list with at least one phrase.`);
          continue;
        }
        if (list.length > LIMITS.phrasesPerMoment) {
          errors.push(`${where} has ${list.length} phrases, more than the ${LIMITS.phrasesPerMoment} allowed.`);
        }
        list.forEach((phrase, i) => {
          checkText(phrase, LIMITS.phrase, `${where}[${i}]`, errors);
          if (typeof phrase === "string") {
            for (const [, key] of phrase.matchAll(/\{([^{}]*)\}/g)) {
              if (!PLACEHOLDERS[moment].includes(key)) {
                errors.push(`${where}[${i}] uses {${key}}, which ${moment} phrases can't use.`);
              }
            }
          }
        });
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: input as unknown as PackLayer };
}

// Checks a complete pack: a valid layer that sets everything.
export function checkPack(input: unknown): Checked<Pack> {
  const layer = checkLayer(input);
  if (!layer.ok) {
    return layer;
  }
  const errors: string[] = [];
  const { name, voice, phrases } = layer.value;
  if (name === undefined) {
    errors.push('A complete pack needs a "name".');
  }
  if (voice?.personality === undefined) {
    errors.push('A complete pack needs "voice.personality".');
  }
  for (const moment of MOMENTS) {
    if (!phrases?.[moment]) {
      errors.push(`A complete pack needs "phrases.${moment}".`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: layer.value as Pack };
}

// Lays a layer over a pack. Whatever the layer sets wins; for phrases, a
// moment's whole list is replaced, so her own lines never mix with defaults.
export function layerOver(base: Pack, layer: PackLayer): Pack {
  return {
    format: PACK_FORMAT,
    name: layer.name ?? base.name,
    voice: { personality: layer.voice?.personality ?? base.voice.personality },
    phrases: { ...base.phrases, ...layer.phrases } as Record<Moment, string[]>,
  };
}

// Fills placeholders like {name}. Unknown or missing values are left as they
// are, so a phrase never shows "undefined".
export function fill(phrase: string, values: Record<string, string>): string {
  return phrase.replace(/\{([^{}]*)\}/g, (match, key: string) => values[key] ?? match);
}
