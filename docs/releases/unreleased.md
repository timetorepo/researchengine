# Unreleased — Native Studio and live activity updates

Not published. This file is a draft, not a downloadable release announcement.

## Changed
- Native Studio interface typography, compact controls and warm graphite styling.
- Selected ResearchEngine identity across the app and prepared desktop assets.
- Replaced the current status island with islandcn's MIT React engine, connected
  to actual research, streaming, agent, skill and focus activity.
- Clicking the app logo returns Home; keyboard activation is supported.
- Reduced-motion users receive a static launch identity instead of its shader.

## Fixed
- Nested notification buttons in the collapsed navigation rail.
- Shared input label/help and invalid-state associations.

## Known limitations / release gates
- Branded installer assets are prepared but Windows compilation, DPI, upgrade
  and uninstall interaction checks are pending. Installer work is paused while
  activity-island changes are reviewed.
- Full-motion first-launch intro still has measured GPU/frame-time stalls.
- Browser tests do not certify physical-device, native WebView or screen-reader
  behaviour. Existing build chunk/dynamic-import warnings remain.

## Upgrade notes
Existing font choices, density, layout and optional floating navigation/activity
preferences are preserved. Allo is the fresh-profile default. No migration or
manual data deletion is required by these UI changes.
