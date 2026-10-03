# 10 — The performance contract

## 1. Targets (brief §5, adopted verbatim; these are the CI gates)

| | 120 Hz class | 60 Hz class |
|---|---|---|
| Frame budget | 8.3 ms | 16.6 ms |
| p95 | ≤ 8.3 ms | ≤ 16.6 ms |
| p99 | ≤ 10 ms | ≤ 20 ms |
| Dropped frames in a scene | < 1 % | < 1 % |
| Input → first pixel | ≤ 8.3 ms | ≤ 10 ms |
| Cold start interactive | ≤ 1.2 s | ≤ 1.8 s |
| Warm start | ≤ 300 ms | ≤ 400 ms |
| Resident memory, chat | ≤ 180 MB | ≤ 220 MB |
| Resident memory, Reader300 | ≤ 350 MB | ≤ 420 MB |
| Battery (1 h reading) | report; ≤ 10 % regression between releases | same |
| Thermal soak (30 min streaming) | targets met or ladder stepped *and said so* | same |

Device floor: iPhone SE 3 / iPhone 11 class; Pixel 4a / Redmi-class 4 GB. Every
number above must be measured on the floor device, not the flagship.

## 2. What exists in this checkout (the honest baseline)

`parity-matrix.md` §0 corrected the brief here: there is **no
`frame-budget.ts`**, no 16.7/22/34 ms sampler, no thermal/battery input. What
exists:

- Startup profiles `eco | balanced | performance` with caps (`backend/src/runtime.ts`
  PROFILES; FE mirror `lib/system/performance.ts`): floodWorkers 1/2/4,
  searchResults 5/7/9, concurrentStreams 1/2/4, backgroundIndexing off/on/on;
  `highMemoryMode` adds +1 worker/stream. PerformanceTab shows live
  rss/heap/db/cache from `GET /api/resources`, 5 s poll.
- Streaming architecture that already protects frames: rAF pacer in
  `lib/flow/engine.ts` ("Rendering NEVER reads the raw stream directly"),
  `content-visibility: auto` + `contain-intrinsic-size: auto 120px` on `.msg-row`,
  route-level code splitting, `useVirtualList` hook (fixed-height windowing).
- Reduced-motion handling already present in CSS.

The mobile governor **extends this**, it does not replace a frame sampler that
was never there.

## 3. The frame-budget governor (R1 introduces; re-core implements)

Inputs: 120/60 Hz frame-time samples (PresentationTimeAnimator on Android,
CADisplayLink via Rust bridge on iOS), profile caps, **thermal state**
(ProcessInfo.thermalState / PowerManager.THERMAL_STATUS_*), **low-power mode**.
Decision: rolling median of last 120 frames.

Thresholds **[gate]**: one 60 Hz frame = 16.7 ms; **22 ms** = "holding, no
headroom"; **34 ms** = expensive layers go. Add the 120 Hz pair: **8.3 ms** and
**11 ms no-headroom**, **17 ms cut**. Hysteresis: two consecutive medians past
threshold to drop, four under to recover (never oscillate in view).

The ladder changes **fidelity only** (brief §5.1 table). The user-visible readout
lives in You → Advanced → Performance (the `PerformanceTab` idea): current level,
median frame time, why it's there, thermal state. `PerformanceTab.tsx`'s 5 s poll
becomes event-driven on mobile (no idle polling — the poll itself is the timer
Part 5.2 bans).

Ring buffer (last 30 min, ≤ 2 MB) records frame times, level changes, thermal
events; exportable JSON from Settings → Advanced (brief §5.5; the exporter lands
R8 but the buffer is R1 so we can prove the numbers early).

## 4. Benchmark scenes (all eight from the brief, budget per scene)

`AnswerStream`, `Reader300`, `QuizRun`, `LibraryScroll`, `GalleryOpen`,
`VoiceHold`, `SearchBurst`, `FloodWatch` — scripts in `mobile/bench/`, run on the
frozen device list in CI (Firebase Test Lab / AWS Device Farm; a budget
regression fails the build the same way `frontend/scripts/smoke.mts` fails a copy
rule today — that test-script discipline is the repo's existing style, 62 checks).
Scene-specific budgets add to §1: Reader300 highlight place → ≤ 10 ms to first
pixel of the sweep; FloodWatch progress paint ≤ one frame from receipt.

## 5. Cost deletions from the mobile build (brief §5.2, applied)

Per-frame `backdrop-filter` (→ `01-tokens.md` §4 policy: blur on ≤ 2 surfaces at
Full only); WebGL background layers `three/@react-three/fiber/@react-three/postprocessing/ogl`
(→ static pre-rendered 2×/3× gradient art generated from `tokens.json`, the five
`--grad-*` meshes are already pure-CSS so the pre-render is trivial); non-virtualized
lists (mobile lint: any `.map(` over a store collection in a scroll container must
go through `useVirtualList`'s successor); layout-property animation (CI grep for
`width|height|top|left|margin` in `animate={{}}`); image decode at source size;
idle timers (the 500 ms `FocusPill` interval and 5 s perf poll are the two
existing ones — both move to event/clock-driven on device).
