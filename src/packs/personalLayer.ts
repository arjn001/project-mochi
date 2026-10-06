// Her personal layer (MOCHI-41): her name and her own touches, laid over the
// default pack. Plain code with no VS Code dependency; in VS Code the store is
// Mochi's private global state, which lives on her own computer (even in
// remote setups) and isn't synced or shared.
//
// The layer is checked strictly on the way in and on the way out, since a
// gift file becomes this layer (see ARCHITECTURE.md).
import { personalStrings } from "../strings";
import { Checked, LIMITS, Pack, PackLayer, TEXT_DIRECTION, checkPersonalLayer, layerOver } from "./format";

export const LAYER_KEY = "mochi.personalLayer";
// A layer that couldn't be read is moved here before anything new is saved,
// so it's never lost.
export const UNREADABLE_KEY = "mochi.personalLayer.unreadable";

// What Mochi keeps the layer in. VS Code's globalState fits this.
export interface Store {
  get(key: string): unknown;
  update(key: string, value: unknown): PromiseLike<void>;
}

// Why a name can't be used, in words for her, or undefined if it's fine.
export function nameProblem(value: string): string | undefined {
  const name = value.trim();
  if (name === "") {
    return personalStrings.nameEmpty;
  }
  if (name.length > LIMITS.name) {
    return personalStrings.nameTooLong(LIMITS.name);
  }
  if (/[\r\n]/.test(name)) {
    return personalStrings.nameOneLine;
  }
  if (/[\u0000-\u001F\u007F]/.test(name) || TEXT_DIRECTION.test(name)) {
    return personalStrings.nameHidden;
  }
  return undefined;
}

export class PersonalLayer {
  private warned = false;

  constructor(
    private readonly store: Store,
    private readonly base: Pack,
    // Tells her, once per session, if her layer couldn't be read.
    private readonly warn: (message: string) => void
  ) {}

  // The stored layer, if there is one and it passes the checks.
  private read(): { layer?: PackLayer; unreadable?: boolean } {
    const stored = this.store.get(LAYER_KEY);
    if (stored === undefined) {
      return {};
    }
    const checked = checkPersonalLayer(stored);
    return checked.ok ? { layer: checked.value } : { unreadable: true };
  }

  // The pack Mochi speaks with right now. Read fresh every time, so a change
  // shows up right away, with no reload. A damaged or too-new layer falls
  // back to the default pack.
  pack(): Pack {
    const { layer, unreadable } = this.read();
    if (unreadable && !this.warned) {
      this.warned = true;
      this.warn(personalStrings.unreadable);
    }
    return layer ? layerOver(this.base, layer) : this.base;
  }

  layer(): PackLayer | undefined {
    return this.read().layer;
  }

  name(): string | undefined {
    return this.read().layer?.user?.name;
  }

  // Saves a whole layer, only if it passes the checks.
  async save(input: unknown): Promise<Checked<PackLayer>> {
    const checked = checkPersonalLayer(input);
    if (checked.ok) {
      await this.keepUnreadable();
      await this.store.update(LAYER_KEY, checked.value);
    }
    return checked;
  }

  async setName(value: string): Promise<Checked<PackLayer>> {
    const layer = this.layer() ?? { format: 1 };
    return this.save({ ...layer, user: { ...layer.user, name: value.trim() } });
  }

  // True if there was a name to forget.
  async forgetName(): Promise<boolean> {
    const layer = this.layer();
    if (layer?.user?.name === undefined) {
      return false;
    }
    const { user, ...rest } = layer;
    const { name: _forgotten, ...otherUser } = user;
    const next: PackLayer = Object.keys(otherUser).length ? { ...rest, user: otherUser } : rest;
    // A layer with nothing left in it is the same as no layer.
    await this.store.update(LAYER_KEY, Object.keys(next).length > 1 ? next : undefined);
    return true;
  }

  async clear(): Promise<void> {
    await this.keepUnreadable();
    await this.store.update(LAYER_KEY, undefined);
  }

  private async keepUnreadable(): Promise<void> {
    if (this.read().unreadable) {
      await this.store.update(UNREADABLE_KEY, this.store.get(LAYER_KEY));
    }
  }
}
