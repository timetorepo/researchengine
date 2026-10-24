# 11. UI component system

The app uses components from several libraries, each vendored or installed for
a reason. This chapter explains which library does what, and the rules for
adding one. Every component is listed, with its props and its file, in
[reference/components.md](reference/components.md) (generated; about 300 entries).

## Where the components live

All app components are in `frontend/src/components/`, in folders named for the
feature they serve. Under `ui/` are the reusable building blocks, grouped by
source:

| Folder | Source | Used for |
|---|---|---|
| `ui/heroui/` | HeroUI (`@heroui/react` 3.x) wrappers | Forms, switches, `Alert` for saved settings and update notices, `InputOTP` for 2FA codes |
| `ui/reactbits/` | ReactBits, vendored (16 components) | Animated backgrounds, GooeyNav, CardSwap, blur and gradient effects |
| `ui/aceternity/` | Aceternity UI, copied source | Hero and marketing effects |
| `ui/skecher/`, `ui/skiper/`, `ui/uiarc/`, `ui/watermelon/`, `ui/untitledui/`, `ui/glass-folder/`, `ui/componentry/` | Copied source from each project | Small, specific pieces (cards, folders, buttons, and similar) |
| `ui/spaceui/` | SpaceUI | `BlurRevealText` (streamed answer text), timelines and handle reels |
| `ui/badge`, `ui/button`, `ui/button-group`, `ui/context-menu`, `ui/dropdown-menu`, `ui/separator` | shadcn-style, Radix-based | Base primitives where HeroUI is not used |
| `smoothui/`, `shadcn-space/` | Copied source | Tabs and small blocks |

Feature folders (`chat/`, `library/`, `ide/`, `design/`, `bots/`, `settings/`, and
so on) hold screens built from these pieces. There are 44 component folders in
`components/`. Two of them, `shared/` and `layout/`, hold code used everywhere: the
palette, the Shell, the sidebar frame.

## Animation

Motion comes from three libraries, each used for one job:

- **`motion`** (`motion/react`): component transitions, layout animation,
  presence (mounting and unmounting).
- **`gsap`**: timeline-style sequences where the order of steps matters.
- **Three.js** (`three`, `@react-three/fiber`, `@react-three/postprocessing`):
  3D and shader backgrounds. These are lazy-loaded, so the cost is paid only when a
  3D background is chosen.

Two further libraries are in the dependencies: `framer-motion` and
`@usespaceui/gradients`. Check the code before adding a third animation library.

The house rules for motion are in [frontend](05-frontend.md#motion): a 150–300 ms
range for most transitions, the same speed for handover pieces, reduced motion
respected everywhere, and no animation that changes layout on every frame.

## Icons and type

- Icons: `lucide-react`. Use it before adding another set.
- Fonts: self-hosted through `@fontsource`. The list is in
  [frontend: entry](05-frontend.md#entry-and-providers).
- Markdown: `react-markdown`, with `remark-gfm`, `remark-math` and `rehype-katex`.

## Styling

Tailwind 4 for layout and spacing. Colour and surface come from CSS variables
set by the theme (see [frontend: theming](05-frontend.md#theming)). Use the variables,
so every one of the 15 themes works without extra code.

`tailwind-merge` resolves conflicting class names. Prefer it over string
concatenation when a component accepts a `className`.

## Adding a component

1. **Check first.** Search `components/ui/` for something close. Most needs are met
   by an existing wrapper.
2. **Vendor, do not import from a CDN.** Copy the source into a folder under
   `components/ui/<source>/`, with the licence file next to it. The ReactBits
   example is `components/ui/reactbits/LICENSE-REACTBITS.md`.
3. **Declare the module** if it has no type definitions, in
   `frontend/src/types/modules.d.ts`.
4. **Wire it through the registry, not in the component.** Background kinds are
   declared in `frontend/src/types/index.ts` (`ANIMATED_BG_KINDS`), their props in
   `lib/backgrounds/themeProps.ts`, and their lazy loader in
   `components/backgrounds/reactBitsBackgrounds.tsx`.
5. **Respect the theme.** Take colours from the variables, not literal values.
6. **Respect reduced motion.** Test with the OS setting on.
7. **Add a test** in `frontend/scripts/` (see [testing](12-testing.md)).

## Props that matter

The components the rest of the app depends on, and the props that are easy to get
wrong:

| Component | Important props | Note |
|---|---|---|
| `GooeyNav` (ReactBits) | `items` (`{label, href}`), `activeIndex`, `onChange`, `animationTime` | Controlled by the parent |
| `CardSwap` (ReactBits) | `items` or `children` (`Card`), `autoplay`, `visibleCards`, `onChange`, `onCardClick`, `ref` (`next()` / `prev()`) | `onChange` reports the front card's index |
| `BlurRevealText` (SpaceUI) | the text, and the reveal settings | Used by `StreamingText` for the live tail |
| `Alert` (HeroUI) | `status` (`default`, `accent`, `success`, `warning`, `danger`) | Used for saved settings and updates |
| `InputOTP` (HeroUI) | `InputOTP.Group` with `InputOTP.Slot index={n}` | Needs the group and slot structure |
| Background kinds | `colors`, plus per-kind props such as `lineCount` (floating lines) or `interactive` (liquid chrome) | Set by `getPropsForTheme` |

ReactBits backgrounds are vendored in the JS-CSS variant. Interactive effects
(mouse ripple on Silk, mouse repulsion on Galaxy, pointer interaction on LiquidChrome)
are turned off in this app.

## Performance

- Every background and 3D component is lazy-loaded (`React.lazy`), so it does not
  weigh on the main bundle.
- Eco mode and reduced motion both replace animated backgrounds with a static
  gradient.
- Heavy components are chosen by the performance profile (see
  [backend: profiles](04-backend.md#profiles)).
