// What the "Make a gift" page (MOCHI-55) shows, and what happens when she
// changes something. Plain code with no VS Code dependency: everything
// comes in through GiftNeeds.
//
// Everything is saved into the gift being made, never her own layer or her
// settings, so making a gift never changes her own Mochi.
import { Confirm } from "../forget";
import { LIMITS, MOMENTS, Moment, PackLayer, placeholdersFor } from "../packs/format";
import { GIFT_LIMITS, GiftDraft } from "../packs/gift";
import { giftStrings, yoursStrings } from "../strings";
import { checkGiftName, checkNote, withTouch } from "./edits";
import { Field, MOMENT_IDS, YoursState } from "./messages";
import { YoursActions } from "./page";

export interface GiftNeeds {
  // The gift being made, and saving it with the gift's checks.
  draft(): GiftDraft;
  saveDraft(draft: GiftDraft): Promise<{ ok: boolean }>;
  // Her own layer, to start from. Only her touches are copied, never her
  // name.
  myLayer(): PackLayer | undefined;
  mochiLines(moment: Moment): string[];
  confirm: Confirm;
}

const hasTouches = (layer: PackLayer | undefined): boolean => layer?.voice?.style !== undefined || MOMENTS.some((moment) => layer?.phrases?.[moment] !== undefined);

// Her touches added to the gift's, where the gift has none yet. What the
// gift already has always stays.
export function startFrom(gift: PackLayer, mine: PackLayer | undefined): PackLayer {
  const next: PackLayer = { ...gift };
  const style = gift.voice?.style ?? mine?.voice?.style;
  if (style !== undefined) {
    next.voice = { style };
  }
  const phrases = { ...mine?.phrases, ...gift.phrases };
  if (Object.keys(phrases).length) {
    next.phrases = phrases;
  }
  return next;
}

export function giftActions(needs: GiftNeeds): YoursActions {
  const state = (): YoursState => {
    const draft = needs.draft();
    const who: Field[] = [
      {
        kind: "text",
        id: "gift.name",
        label: giftStrings.askName,
        value: draft.layer.user?.name ?? "",
        placeholder: "",
        maxLength: LIMITS.name,
        clearable: true,
      },
    ];
    const from: Field[] = [
      {
        kind: "text",
        id: "gift.from",
        label: giftStrings.from,
        value: draft.from ?? "",
        placeholder: giftStrings.fromPlaceholder,
        maxLength: GIFT_LIMITS.from,
        clearable: true,
      },
      {
        kind: "longText",
        id: "gift.note",
        label: giftStrings.note,
        description: giftStrings.noteDescription,
        value: draft.note ?? "",
        maxLength: GIFT_LIMITS.note,
      },
    ];
    const touches: Field[] = [
      ...(hasTouches(needs.myLayer()) ? [{ kind: "actions" as const, now: "", buttons: [{ id: "startFromMine" as const, label: giftStrings.startFromMine }] }] : []),
      {
        kind: "longText",
        id: "gift.style",
        label: yoursStrings.style,
        description: yoursStrings.styleDescription,
        value: draft.layer.voice?.style ?? "",
        maxLength: LIMITS.style,
      },
      ...MOMENT_IDS.map(
        (moment): Field => ({
          kind: "lines",
          id: `gift.lines.${moment}`,
          label: yoursStrings.moments[moment],
          description: `${giftStrings.linesDescription} ${yoursStrings.canUse([...placeholdersFor(moment)])}`,
          value: draft.layer.phrases?.[moment] ?? [],
          example: needs.mochiLines(moment).join("\n"),
        })
      ),
      { kind: "actions", now: "", buttons: [{ id: "startOver", label: giftStrings.startOver }] },
    ];
    return {
      title: giftStrings.title,
      intro: giftStrings.intro,
      saved: yoursStrings.saved,
      sections: [
        { heading: giftStrings.who, fields: who },
        { heading: giftStrings.fromYou, fields: from },
        { heading: yoursStrings.touches, fields: touches },
      ],
    };
  };

  const save = async (draft: GiftDraft) => ((await needs.saveDraft(draft)).ok ? { ok: true as const } : { ok: false as const, hint: yoursStrings.couldntSave });

  return {
    state,
    async edit(field, value) {
      const draft = needs.draft();
      if (field === "gift.name") {
        const checked = checkGiftName(value);
        if (!checked.ok) {
          return checked;
        }
        const { user: _old, ...layer } = draft.layer;
        return save({ ...draft, layer: checked.name ? { ...layer, user: { name: checked.name } } : layer });
      }
      if (field === "gift.from") {
        const checked = checkGiftName(value);
        if (!checked.ok) {
          return checked;
        }
        const { from: _old, ...rest } = draft;
        return save(checked.name ? { ...rest, from: checked.name } : rest);
      }
      if (field === "gift.note") {
        const checked = checkNote(value);
        if (!checked.ok) {
          return checked;
        }
        const { note: _old, ...rest } = draft;
        return save(checked.note ? { ...rest, note: checked.note } : rest);
      }
      if (field === "gift.style" || field.startsWith("gift.lines.")) {
        const touch = field === "gift.style" ? "style" : (field.slice("gift.lines.".length) as Moment);
        const next = withTouch(draft.layer, touch, value);
        return next.ok ? save({ ...draft, layer: next.layer }) : next;
      }
      // Anything else isn't part of a gift.
      return { ok: false, hint: yoursStrings.pickOne };
    },
    async button(button) {
      const draft = needs.draft();
      if (button === "startFromMine") {
        await needs.saveDraft({ ...draft, layer: startFrom(draft.layer, needs.myLayer()) });
      } else if (button === "startOver") {
        if (await needs.confirm(giftStrings.startOverQuestion, giftStrings.startOverDetail, giftStrings.startOver)) {
          await needs.saveDraft({ layer: { format: 1 } });
        }
      }
    },
  };
}
