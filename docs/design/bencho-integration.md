# Bencho integration

Source: `cabralorenzo/bencho`, pinned at
`c65992417427bb09e661674ffa800bef29adef49`. Eighteen actual upstream blocks
are adapted under `frontend/src/components/ui/bencho`, with the MIT notice,
licence and original-file hashes in `upstream.json`. No additional runtime
package, paid source, website photographs or website fonts were added.

## Product placements

| Block | Consumer |
| --- | --- |
| Signature | Optional local profile artwork; save, export, remove; not verification |
| Dynamic Island | Existing live activity state and supported actions |
| Time Scrubber | Optional first bot routine run, editable time and timezone; interval recurrence retained |
| Particles | Successful workflow completion, opt-in workspace effects |
| Generate | Actual ImageLab request/loading and returned-image reveal; no simulated progress |
| Action Node | Workflow export, share, start and stop |
| Slide Confirm | Workflow deletion, with explicit button alternative |
| Picker | Group chat bot membership without duplicates |
| Palette | Appearance roll, colour editing, contrast preview, apply and CSS/JSON export |
| Liquid Toggle | Shared application Switch wrapper |
| Sound | Existing music engine transport, seek, volume and repeat; user-started only |
| Pull | CRM refresh over existing service data; press alternative |
| Aspect | Supported landscape, square and portrait image generation sizes |
| Seek | Controlled Chats and Library searches |
| Liquid Create | Workflow blank/template/import actions |
| ASCII Wake | Empty coding context, opt-in workspace effects |
| Stacked Bars | Recorded daily/weekly token usage, including honest empty state |
| Magnetic Select | Controlled palette colour count |

App and OS reduced-motion preferences suppress optional canvas effects; hidden
or offscreen effects unmount. The token bridge is scoped to Bencho consumers.
Palette colours are independent of structural layout preferences. Sharing and
export use the existing workflow secret-scrubbing serializer.

## Verification

- TypeScript check and frontend/backend production build passed.
- `tools/design/check-bencho.mjs`: palette count/roll/download/apply/persistence/
  restore, live focus island/Escape, Chats search, two-bot group creation,
  09:15 routine scheduling, workflow create/download/keyboard-confirm deletion,
  drawn signature save and recorded 1,234-token usage; no page errors.
- Existing settings, shell and workspace browser regressions passed, including
  keyboard Switch handling and 320/390px shell layouts.
- Bot logic: 34 tests passed. Music engine: 16 checks passed, including frozen
  paused position, resume metadata, seeking and repeat.
- Rendered palette and bot screenshots inspected; corrected clipped palette
  option text and a Create menu that previously opened under the topbar.

Browser tests use an isolated local profile and seeded application data, not
real provider/CRM accounts. Live image-provider requests, live CRM services,
native OS share dialogs, physical touch devices, screen readers and complete
200% zoom coverage remain unverified. Existing Vite mixed-import and large-chunk
warnings remain; build success is not a performance benchmark.
