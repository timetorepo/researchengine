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
