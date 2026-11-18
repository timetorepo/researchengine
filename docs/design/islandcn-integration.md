# islandcn replacement

User requested islandcn before continuing installer work. The actual MIT engine
is vendored from opencoredev/islandcn commit
0011a41ea4882f3818caf35c98f3ee46b80c4a2c, lib/island TS/TSX files, under
frontend/src/lib/island. Licence: docs/licenses/islandcn-MIT.txt. No shadcn CLI
execution, dependency additions, presets, Hugeicons installation or demo jobs.
Public install/agent docs and upstream source/licence were reviewed first.

DynamicIsland now owns one IslandProvider and one viewport Island when enabled
(or in the existing OS shell). The existing opt-in preference is retained. Real
useUI activity events (streaming token count, source count, agents, focus time,
skill name) start/update/end one activity handle. The current application source
is a single-activity union; this change does not invent simultaneous activities
or timers to demonstrate split mode. Idle uses islandcn's resting capsule.

Tap or keyboard activation expands details. The real stop-response and provider
settings actions remain. Outside press and Escape use engine behaviour; existing
global shortcut state is synchronised. Reduced motion follows app or OS settings.
The old Bencho renderer is no longer imported by DynamicIsland; its source and
licence remain for provenance rather than deleting unrelated existing work.
Glisse is still navigation, islandcn is status. They are not interchangeable.

AppLogo is now a semantic router Home link with keyboard activation; it also
closes mobile navigation/settings so Home is visible. Existing long-press sonar
behaviour is retained. Noninteractive decorative marks inside messages are not
turned into surprise navigation controls.

Verification: check-islandcn.mjs covers engine singleton/old renderer absence,
real focus event, compact content, tap expansion, Escape, 390px overflow,
keyboard logo Home, idle cleanup, no page errors. Production/type checks recorded
in the task completion response. Native WebView/screen reader/physical device
rendering are not certified by headless Chromium. No installer work or release
publication took place in this change.
