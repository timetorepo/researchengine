// Research Engine desktop shell — Tauri 2.
// The local backend (single-process Node server) is started via beforeDevCommand
// during `tauri dev`; for release builds, distribute the portable binary
// alongside the app or wire it up as a Tauri sidecar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Research Engine")
}
