# 13. Contributing

The short version is in [docs/development.md](../development.md#contributing).
This chapter adds the parts a new developer needs in the first week.

## First day

1. Read [overview](01-overview.md) and [architecture](03-architecture.md).
2. Install and run the app from a checkout, using the steps in
   [docs/development.md](../development.md#requirements). Install the root
   dependencies with `npm ci --ignore-scripts` (see the note below).
3. Open the app and click through each route listed in
   [frontend: routing](05-frontend.md#routing).
4. Read the header comments of the files you plan to change. In this project they
   are the main design notes, and they are kept current more often than this
   handbook is.

> **Install note.** Run `npm ci --ignore-scripts` from the repository root. The
> `onnxruntime-node` install script fails in some environments, and skipping
> scripts is safe for development. Do not run `npm ci` inside `frontend/` or
> `backend/` on its own; it can remove the nested `@heroui/react` install.

## Branches and commits

- Work on the branch you were given. Do not create or push to other branches.
- Keep commits focused. One feature or fix per commit, with a message that says
  what changed and why.
- Do not rewrite or move a published tag. A release tag is public.
- Generated files are fine to commit when the repository already keeps them (for
  example `downloads/` and the handbook's `reference/` files). Large datasets and
  build output are not.

## Code conventions

- **TypeScript strict.** Both workspaces must pass the type check.
- **No invented APIs.** Verify a library call against the installed package before
  using it.
- **No placeholder data** in a delivered change: no TODOs, stubs or fake results
  in the UI. If something is unavailable, the UI says so.
- **Honest failures.** A check that cannot run reports "unchecked", not "passed".
- **Visual bar.** Contrast of at least 4.5:1, a 4 px spacing rhythm, real
  interactive states, 150–300 ms motion, and reduced motion respected.
- **Themes.** Use CSS variables, not literal colours.
- **Comments.** Explain why, especially for decisions a later reader might undo.
  The header comments in the code are the model to follow.

## Adding things

- **A screen:** see [frontend: adding a screen](05-frontend.md#adding-a-screen).
- **A tool the AI can call:** see [chat engine: tools](06-chat-engine.md#tools).
- **A backend route:** add a module under `backend/src/routes/`, mount it in the app
  (see [backend: route modules](04-backend.md#route-modules)), and add a
  test under `backend/scripts/`.
- **A provider:** see [chat engine: where to change things](06-chat-engine.md#where-to-change-things).
- **A background or component:** see [UI component system](11-ui-component-system.md#adding-a-component).
- **A service:** check its licence and its public API before writing an adapter.
  Read the official docs. Where an endpoint cannot be confirmed, say so in the
  adapter's comment rather than guessing.

## Pull requests

- Say which suites you ran and their results (see [testing](12-testing.md#what-to-run-before-a-change)).
- Say what you did not verify. A visual check that was not possible is a note, not
  a silent omission.
- Link the handbook chapter you changed, if the change affects how something works.
  A change to the architecture or a route should update the matching chapter, and
  the generated references should be rebuilt with
  `node docs/technical/tools/generate-reference.mjs`.

## Releases

See [release process](10-desktop-website-release.md#release-process). Releases are
the maintainer's call. Do not tag a release unless it is asked for.

## Licences

The project's own code is MIT-licensed (see `LICENSE`). Vendored components keep their own
licences, and each is credited in the About tab and in a notice file next to the
vendored code. When you vendor something, add its licence file and check it allows
your use. Commercial use may be restricted by some licences (for example, the
ReactBits licence carries the Commons Clause).
