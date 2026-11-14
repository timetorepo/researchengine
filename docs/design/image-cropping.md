# Local image editing (v1.9.0)

Approved proposal: one reusable, lazy-loaded zriz editor for profile photos,
chat attachments, appearance backgrounds, wallet artwork, local Article image
replacement and quiz Share Studio images. Other file/document upload paths are
not converted into images or forced through a cropper.

Pinned npm packages: @zriz/react and @zriz/core 0.2.1, reviewed as published
archives before installation with scripts disabled. MIT, Copyright (c) 2026
Dmytro; see docs/licenses/zriz-MIT.txt and Settings → About. These headless
packages use no new runtime dependencies beyond their declared React/core peers.

The editor provides crop handles, keyboard controls, zoom, straighten, rotate,
flip, reset, explicit Apply and Cancel. Avatar crops lock square with a circular
preview and export at up to 512px; other crops retain full output dimensions.
Use original bypasses re-encoding for non-avatar uploads (preserving animation).
Applied crops are still PNGs. SVG editing is disabled; non-avatar original-file
flows remain available. No new arbitrary MB cap is imposed. Actual browser
resource/decoder limitations surface errors. Chat retains its three-image limit.

Cropping is local. zriz chooses worker decoding/export where supported and its
fallback otherwise; no external crop endpoint is called. AbortSignal cancels
export on dismissal. A serial request queue handles multi-file picks. Modal
focus is restored after teardown; profile state is read fresh on avatar updates
so an outstanding crop does not overwrite unrelated profile changes. Existing
background downscaling remains at 1600px and a fallback object-URL leak is fixed.
Photos are stored with existing local profile data and can be removed to restore
the generated avatar. Existing browser-storage quotas still apply.

Verification: TypeScript and frontend/backend production build passed; 12 BoardUI
and 15 kit component checks passed. check-image-crop.mjs exercises actual image
export, square dimensions <=512px, profile persistence after reload, nested
Escape cancellation, removal, byte-preserving original and invalid-image error
recovery. Desktop loaded-crop and 390px error-state screenshots inspected.
No physical-device, native WebView, screen reader, huge-image memory, animated
format fidelity after crop, or live model image-send certification is claimed.

Local desktop-check: 32 structural checks passed; the sidecar-existence check
failed because no local compiled sidecar was present. GitHub desktop CI compiles
and boots its sidecar before building/verifying installers. CI outcome must be
reported separately, not inferred from the frontend build.

The pre-existing cold settings performance limitation from boardui-progress.md
remains unresolved. Package description claims are not a 60fps certification.
