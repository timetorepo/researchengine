# Research Engine — Desktop shell (Tauri 2)

A native-feeling desktop app: the OS webview (WebView2 / WKWebView / WebKitGTK)
plus the Research Engine local backend. No Electron, tiny RAM overhead.

## Prerequisites

- **Rust** (stable) — https://rustup.rs
- **Platform webview deps** — on Linux: `webkit2gtk-4.1`, `libappindicator`,
  `librsvg`; on Windows/macOS nothing extra is needed. Full list:
  https://tauri.app/start/prerequisites/
- Node 20+ (to build the frontend + run the backend)

## Develop

```bash
cd desktop
npm install
npm run tauri:dev
```

This starts the single-process backend on `127.0.0.1:3847` and opens the app
window pointed at it.

## Build installers

```bash
npm run tauri:build
```

Artifacts land in `src-tauri/target/release/bundle/`:
- macOS: `.app` / `.dmg`
- Windows: `.msi` / `.exe`
- Linux: `.deb` / `.AppImage`

> macOS builds also want an `.icns`; generate the full icon set from the
> source image with `npm run icons` (writes every platform format).

## Shipping the backend with the app

Two supported layouts:

1. **Side by side** — bundle the output of `node scripts/package-binary.mjs`
   next to the app and launch it on app start.
2. **Tauri sidecar** — add the portable binary to `bundle.externalBin` in
   `tauri.conf.json` and spawn it from Rust for lifecycle-managed startup.

Either way the app data lives in `~/.research-engine` and the window opens
instantly — onboarding offers Eco mode automatically on machines with 8 GB
RAM or less.
