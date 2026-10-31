# Painted grain: a style for Codersa and ResearchEngine

A visual direction that combines two references:

- **Cursor (cursor.com):** one large, quiet object (a product window or a painted scene) sits over a dark, plain backdrop. The chrome stays quiet, and the picture carries the mood. Their product demos sit over "a scenic painted landscape wallpaper", and the rest of the page is a solid brand background.
- **ElevenLabs (elevenlabs.io):** big, plain headlines over textured, grainy gradient backgrounds, with creative imagery placed inside them.

Both were read from the sites' text and page structure. I could not inspect their exact colours or CSS, so the values below are our own, chosen to fit the same idea.

## The three layers

1. **Gradient mesh.** Soft radial colour from the theme accent, with an optional warm ochre (`warm`) or cool steel (`cool`) tint. It sits under everything.
2. **Painting (optional).** One public-domain painting from `/public/art`, shown in normal blend at 50–60% strength, with a readability wash that fades to the theme background at the bottom where the text sits.
3. **Grain.** An inline SVG noise tile (`feTurbulence`) at 10–14% opacity, in soft-light blend. No network request.

## Rules

- **One painting per screen.** It is the bright object. Everything around it stays on the theme neutrals.
- **Text uses the existing tokens** (`--text`, `--text-2`, `--text-3`). The backdrop never changes text colour.
- **Grain stays between 0.08 and 0.16.** Above about 0.25 it reads as noise rather than paper.
- **Animate only transform and opacity.** The slow drift is off under `prefers-reduced-motion`.
- **Painting is decoration.** It is always `alt=""`.

## Usage

```tsx
import { GrainGradient } from '@/components/backgrounds/GrainGradient'

<GrainGradient tint="warm" grain={0.12} painting="/art/codersa-backdrop.jpg" paintingFocus="50% 40%">
  …content…
</GrainGradient>
```

Pass no `painting` for a plain gradient. Pass `grain={0}` to remove the texture.

## Where it is and is not applied

- The component and CSS exist: `frontend/src/components/backgrounds/GrainGradient.tsx` and `GrainGradient.css`.
- It is **not yet** applied to any screen. The Codersa empty state and the Home hero still use `PaintedBackdrop`, which is unchanged.
- The preview was checked in a standalone page at 1320px wide, not inside the running app.
