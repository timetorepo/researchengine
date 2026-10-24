Research Engine desktop sidecar — linux-x64 (x86_64-unknown-linux-gnu)
Mode: single-file executable (no Node required)

Built by scripts/desktop-sidecar.mjs. Tauri copies it next to the app binary;
the shell spawns it on 127.0.0.1:3847 and waits for /api/health before showing
the window. Do not rename the file — the target triple in the name is what
Tauri's `bundle.externalBin` matches.
