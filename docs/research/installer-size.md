# Installer size: what is in the desktop download

Measured on Linux x64 with the same build steps as `desktop/ci/desktop.yml`
(`scripts/desktop-sidecar.mjs --target linux-x64`, Bun 1.4.2). The published
installers were not downloaded: the release-asset host is not reachable from the
build sandbox, and the Tauri shell needs Rust, which is not installed there. The
numbers below are for the parts that go into the installer.

## Where the bytes are

| Part | Raw size | Compressed (xz -6) | Notes |
|---|---|---|---|
| Bun runtime (hello-world compile) | 81.3 MB | 28.3 MB | The floor for any single-file Bun executable. |
| Research Engine sidecar | 81.8 MB | 28.4 MB | Runtime plus about 0.5 MB of our own bundled code (237 modules). |
| Frontend `dist/` (bundled as a resource) | 41.5 MB | 9.7 MB | Includes the ONNX Runtime WebAssembly below. |
| ONNX Runtime WebAssembly `ort-wasm-simd-threaded.jsep` | 21.6 MB | 2.9 MB | Used by on-device meeting transcription, which runs on the CPU (`device: 'wasm'`). |
| Other frontend JavaScript | about 14 MB | not measured | 222 files. The largest is a 2.4 MB catalogue chunk. |

## What this means

- **Stripping the sidecar saves nothing** (81.8 MB to 81.7 MB). Our code is a
  rounding error next to the runtime.
- **The runtime cannot be made smaller** from this project. A smaller installer
  would need a different way to ship the server, for example Node with a bundled
  `node_modules`. That trades size for a bigger, slower start, so it is not a
  free win.
- **The ONNX WebAssembly is the one large, optional piece.** Removing it from the
  installer would mean fetching it on first use. That changes how transcription
  works offline, so it needs a browser test before it ships.
- **Unreferenced static files are not worth removing.** Files in `dist/` that no
  JavaScript, CSS or HTML names total about 0.2 MB. Some wallpapers may be loaded
  by a computed path, so removing them could break the app.

## Not yet explained

The published 1.7.0 `.deb` is 79.5 MB. The parts above add up to about 38 MB
compressed (sidecar 28.4 MB plus frontend 9.7 MB), so about 40 MB of the `.deb` is
unexplained. Checking it needs the
published `.deb` (`dpkg-deb -c`), or a Linux build with Rust installed. That is
the next step if the installer size matters.
