# SpaceUI components

`blur-reveal-text.tsx` is SpaceUI's *Blur Reveal Text* (`components-spaceui-blur-reveal-text`),
vendored from the registry source at https://github.com/usespaceui/ui
(`src/registry/components/spaceui/blur-reveal-text/index.tsx`, pinned at the commit cloned on 2026-10-23).

It was meant to be installed with `npx shadcn@latest add @spaceui/components-spaceui-blur-reveal-text`.
That command needs `ui.shadcn.com`, which the build sandbox cannot reach, so the same file was copied by hand.
The only change: its `cn` import points at this app's `@/lib/utils` (the CLI would write `@/lib/utils` too).
Dependencies: `motion` (already installed). License: see the upstream repository.
