# 11 — The latency contract: 10 ms or 200 ms

Two tiers; every user-visible operation is in exactly one. The brief's origin
story for 200 ms ("`backend/src/routes/library.ts` already carries
`BUDGET_MS = 200`") **does not exist in this checkout** (see
`parity-matrix.md` §0) — so on mobile this contract is authored here, and the
desktop backend adopts it in R2 when the library route is built. That is stated
so nobody "inherits" a budget that isn't in the code.

## Tier 1 — 10 ms: everything the device already knows

Measured input-event → first visible response. Budget **[gate]**: ≤ 8.3 ms p95 on
120 Hz panels, ≤ 10 ms p95 on 60 Hz. In it:

- touch-down acknowledgement on every control (`.press-tap` 16 ms CSS is the
  existing desktop behaviour — tier-1 *by construction* since it needs no JS)
- tab switches, sheet-open start, theme switch, long-press menu open, detent snaps
- selection, caret moves, focus, keyboard appearance begin
- opening Command sheet / attachments tray / model picker
- **local library search** (the FTS5 index in `re-core`, R2 — the 10 ms claim
  lives or dies on `LibraryScroll` + R2's 50k-doc test)
- reading a chat or note from SQLite; cached reader page; marking a sentence;
  timer start/stop; task toggle; quiz answer selection; haptics

How: in-memory index warm at launch; prepared, cached SQLite statements; reads off
main thread with same-frame publish on cache hit; every write is local-first and
optimistic; **no network call may ever sit on a tier-1 path** (CI: network stub
throws in the tier-1 harness). Verified by the latency harness (synthetic input →
frame timestamp) per interaction on device. Tier-1 miss = bug, not tuning.

## Tier 2 — 200 ms: everything that leaves the device

Action → first meaningful thing on screen. Budget **[gate]**: p50 ≤ 200 ms,
p95 ≤ 350 ms, truthful progress after that (what is happening, what is awaited,
a cancel path — `09-states.md` covers the copy). In it:

- the search ladder (lanes documents→Wikipedia→trusted; per-lane results, `why()`
  on failure — new for mobile *and* desktop, see parity §1)
- first visible output of an answer: question echoed, local hits rendered, source
  skeleton shown, stream open. Model token speed is *not* in the budget; the
  promise is "honest pixels in 200 ms, then never a blank line" — the pacer
  (`flow/engine.ts`) starts on first chunk, ≥ 30 tok/s perceived
- companion local-network round trips (health, library query, job ack, scope check)
- provider connection setup — DNS + TLS + first byte; today `stream.ts` connects
  on send, mobile prewarms on app-active and caches DNS
- already-warm on-device model load (cold load is a separate announced progress bar)
- dictation start (mic open + meter moves)

How: prewarm connections; deadlines + cancellation on every request (the
`AbortController` pattern already spans InputBar stop → stream signal); UI never
awaits an uncancellable promise; stale-while-revalidate with a "refreshing" state
for repeat queries (the flow `cache.ts` in `lib/flow/cache.ts` — "keyed
localStorage, capped" — is the seed; mobile moves it into `re-core`).

## The three never-numbers (brief §6, as CI checks)

1. spinner > **400 ms** with no sentence → test failure
2. progress > **2 s** with no cancel affordance → test failure
3. any blank frame during navigation → old screen stays until new paints
   (route transitions push over content; the lazy `React.lazy`/`RouteSkeleton`
   pattern from `App.tsx` is the ancestor, mobile adds keep-previous-frame)
