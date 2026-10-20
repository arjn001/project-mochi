// The gift being made (MOCHI-55), kept apart from her own personal layer.
// Plain code with no VS Code dependency; in VS Code the store is Mochi's
// private global state, like her layer, but under its own key. Nothing here
// is ever laid over her pack, so making a gift never changes her own Mochi.
// It's kept so closing the page doesn't lose a half-written gift, and
// "Forget everything" clears it.
import { Checked, PACK_FORMAT } from "./format";
import { GiftDraft, checkGiftDraft, layerIsEmpty } from "./gift";
import { Store } from "./personalLayer";

export const DRAFT_KEY = "mochi.giftDraft";
// A draft that couldn't be read is moved here before anything new is saved,
// so it's never lost.
export const UNREADABLE_DRAFT_KEY = "mochi.giftDraft.unreadable";

const isEmpty = (draft: GiftDraft): boolean => draft.from === undefined && draft.note === undefined && layerIsEmpty(draft.layer);

export class GiftDrafts {
  constructor(private readonly store: Store) {}

  private read(): { draft?: GiftDraft; unreadable?: boolean } {
    const stored = this.store.get(DRAFT_KEY);
    if (stored === undefined) {
      return {};
    }
    const checked = checkGiftDraft(stored);
    return checked.ok ? { draft: checked.value } : { unreadable: true };
  }

  // The gift being made, or an empty one. A damaged draft reads as empty.
  // A copy, so changing it changes nothing until it's saved.
  draft(): GiftDraft {
    return structuredClone(this.read().draft ?? { layer: { format: PACK_FORMAT } });
  }

  // Saves the draft, only if it passes the checks. An empty draft is the
  // same as none.
  async save(input: unknown): Promise<Checked<GiftDraft>> {
    const checked = checkGiftDraft(input);
    if (checked.ok) {
      if (this.read().unreadable) {
        await this.store.update(UNREADABLE_DRAFT_KEY, this.store.get(DRAFT_KEY));
      }
      await this.store.update(DRAFT_KEY, isEmpty(checked.value) ? undefined : checked.value);
    }
    return checked;
  }

  // For "Forget everything": the draft, and any unreadable one kept aside.
  async forgetAll(): Promise<void> {
    await this.store.update(DRAFT_KEY, undefined);
    await this.store.update(UNREADABLE_DRAFT_KEY, undefined);
  }
}
