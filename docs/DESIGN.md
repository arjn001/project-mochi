# Design

Mochi's visual identity. The rest of this doc arrives with MOCHI-50. Every
part of Mochi must look right in any VS Code theme: light, dark, and high
contrast.

## Icons

![The Pillow Loaf icons, early versions, on dark, light, purple, and black bars](design/icon-comparison.png)

*Early versions, before the faces were snapped to the pixel grid. The
"napping (ChatGPT)" pose was replaced by "napping (new)".*

### Style
- **Pillow Loaf:** a soft, solid cat shape, like a loaf of bread.
- **Solid:** one filled shape per icon. The eyes and nose are cut-outs, so
  they take the background color.
- **One pose per mood:** here (eyes open), purring (happy closed eyes), and
  napping (curled up asleep).

### How they were made
- **here and purring:** explored with ChatGPT.
- **napping:** redrawn by Claude for 16px readability.
- **All three:** converted to nonzero winding by Claude, so the cut-outs
  survive icon-font tools.
- **Facial features snapped to the 16px pixel grid by Claude**, after the
  built-font test showed blurry holes at 1x. In that redraw, napping's body
  also moved about half a pixel to the right.
- The first versions carried C2PA content credentials. The grid-snapped
  redraws don't.

### How they're tested
The built font is tested, not the SVGs. Each glyph is rendered at 16px, at 1x
and 2x, on dark (`#181818`) and light (`#f8f8f8`) backgrounds. An icon passes
only if the eyes and nose show as clean holes, the three moods are clearly
different, and nothing is clipped, at both 1x and 2x.

### Files
- `media/icons/`: the source SVGs. One path each, 16x16, `currentColor`.
- `media/font/mochi-icons.woff`: the built font. Rebuild it with
  `npm run build:icons` after changing an SVG, and commit it.
- `.fantasticonrc.js`: the font settings. Same grid as VS Code's own icons
  (300 units, on the baseline), and fixed character numbers: here `E001`,
  purring `E002`, napping `E003`. Never renumber them; a new mood takes the
  next free number.
- `package.json` registers each mood under `contributes.icons`, so text can
  use it as `$(mochi-purring)`. A unit test checks that these numbers match
  the font settings.

### Where they're used
- **Status bar:** `$(mochi-purring) Mochi is purring`.
- **Mochi's tab in the secondary side bar:** `media/icons/mochi-here.svg`.
