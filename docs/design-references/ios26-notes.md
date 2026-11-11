# iOS 26 reference notes

Working notes from reference screenshots, used to shape the app's Apple-style
surfaces. Images are kept outside the repository (they are third-party press
photos); only the observations are recorded here.

## Batch 1 — Settings, Liquid Glass (5 images, 2 studied closely)

- **Grouped cards with large soft corners.** Settings rows sit in one rounded
  group. The group's corner radius is large, and the surface is flat, with no
  hard border.
- **Inset hairlines.** Separators start at the text edge, not the screen edge.
- **Glass for floating controls.** The toolbar pill over the preview is a
  translucent, blurred capsule. The "Clear" and "Tinted" choice is a glass
  group, not a solid one.
- **Selection is a blue tick**, on the right of the row. Toggles are green when on.
- **Explanatory text sits under the group** in small grey type, aligned to the
  group's text edge.
- **Chevrons and values on the right** ("Clear >", "Light Until Sunset >").
- **Preview-first pickers.** The theme and glass choices show a live thumbnail
  above the option list.

## What this means for the app's cards

- One corner radius for all cards (22px), with a faint top highlight.
- Rows inside a card use inset hairlines and a right-hand value or chevron.
- The one prominent action is a capsule; everything else is quiet.
- Explanatory text goes under the group, in grey.

Implemented as `frontend/src/components/ui/apple/AppleCard.tsx`.

## Batch 2 — Wallet, Control Center, Photos tab bar (20 results, 3 studied closely)

- **Wallet card details (sheet):** a large bold title with a grey subtitle beneath,
  a round grey close button top left, and a round blue confirm button top right.
  Form fields sit in one grouped rounded card with inset hairlines, the label on
  the left and the value on the right.
- **Control Center (dark):** tiles are translucent glass with a faint coloured
  glow behind them (blue, violet) rather than a solid fill. Toggles are round
  buttons, and sliders are tall capsules.
- **Photos tab bar:** a floating glass capsule holds the two tabs. The search
  control sits apart in its own round glass button. The active tab is tinted
  blue, and the inactive one is black.

## Pattern so far

- Two shapes do most of the work: large rounded rectangles for groups and tiles,
  and circles or capsules for single actions. Keep these two apart.
- Blur and glow appear behind floating controls, not behind dense text.
- Selection and active state use the accent colour. Nothing else is coloured.

## Batch 3 — Apple Pay sheet, Home Screen widgets, App Store (20 results, 3 studied)

- **Apple Pay sheet:** a bottom sheet with a generous top corner and the wordmark
  at top left. The close control is a small grey circle at top right. Options
  are rounded white rows, each with a chevron on the right. Secondary text is
  grey, and a tag such as "Pay Later" is an outlined capsule.
- **Home Screen:** widgets are rounded glass tiles, sized to the grid. Icons are
  rounded squares with depth, and labels sit under them in small type.
- **App Store listing:** iOS 26 replaces opaque bars with floating glass bars.
  Content runs under them, so the bars need blur and a soft edge.

## Totals

- Batch 1: 5 results, 2 studied. Batch 2: 20 results, 3 studied.
  Batch 3: 20 results, 3 studied.
- Trimmed from the original 100 target to 4 extra batches, as agreed.
