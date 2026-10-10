// Research Engine desktop shell — Tauri 2.
//
// The webview is the OS's own engine (WebView2 / WKWebView / WebKitGTK) and the
// product itself is the local Research Engine server, compiled to a single
// self-contained binary ("the sidecar") by scripts/desktop-sidecar.mjs.
//
// Boot order matters, so it is explicit:
//   1. Is a Research Engine server already answering on loopback? (a dev server
//      or a second instance of this app) — reuse it instead of starting a twin.
//   2. Otherwise spawn the sidecar next to the app binary with FRONTEND_DIST
//      pointing at the bundled frontend.
//   3. Poll /api/health over a raw TCP socket — a connect is not enough, the
//      process must actually answer — then open the window straight at it.
//
// No IPC, no shell plugin, no Node on the user's machine: the window is the
// product, the sidecar is the backend, and both die together.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// Loopback port the local server listens on. Overridable so a desktop build
/// can coexist with a dev server on the default port.
const DEFAULT_PORT: u16 = 3847;
/// How long we are willing to wait for a cold start on a slow machine.
const BOOT_TIMEOUT: Duration = Duration::from_secs(40);

/// The sidecar process, so it can be reaped when the app exits.
struct Sidecar(Mutex<Option<Child>>);

fn port() -> u16 {
    std::env::var("RE_DESKTOP_PORT")
        .ok()
        .and_then(|v| v.trim().parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT)
}

fn sidecar_name() -> &'static str {
    if cfg!(windows) {
        "research-engine.exe"
    } else {
        "research-engine"
    }
}

/// True when OUR server answers /api/health on loopback.
fn health_ok() -> bool {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port());
    let mut stream = match TcpStream::connect_timeout(&addr.into(), Duration::from_millis(400)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1500)));
    let req = format!(
        "GET /api/health HTTP/1.0\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        port()
    );
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut body = String::new();
    if stream.read_to_string(&mut body).is_err() {
        return false;
    }
    body.contains("research-engine-backend")
}

/// Where the sidecar can live, most specific first:
/// next to the app binary (what installers produce), the Tauri resource dir,
/// then a checkout's `binaries/` folder for `tauri dev`.
fn sidecar_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(sidecar_name()));
            candidates.push(dir.join("binaries").join(sidecar_name()));
            candidates.push(dir.join("sidecar").join(sidecar_name()));
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        candidates.push(res.join(sidecar_name()));
        candidates.push(res.join("binaries").join(sidecar_name()));
        candidates.push(res.join("sidecar").join(sidecar_name()));
    }
    // `tauri dev`: the freshly built sidecar carries its target triple in the
    // name (that is how Tauri's externalBin is addressed), so take whatever
    // executable-looking file that folder holds.
    let dev_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries");
    candidates.push(dev_dir.join(sidecar_name()));
    if let Ok(entries) = std::fs::read_dir(&dev_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("research-engine-") || name.ends_with(".txt") || name.ends_with(".cmd")
            {
                continue;
            }
            if cfg!(windows) {
                if name.ends_with(".exe") {
                    candidates.push(path);
                }
            } else {
                candidates.push(path);
            }
        }
    }
    candidates.into_iter().find(|p| p.is_file())
}

/// The built frontend the server should serve. In an installed app this is a
/// bundle resource; in a checkout it is the workspace's `frontend/dist`.
fn frontend_dist(app: &tauri::AppHandle) -> Option<PathBuf> {
    let looks_built = |dir: &Path| dir.join("index.html").is_file();
    let mut candidates: Vec<PathBuf> = Vec::new();
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(res) = app.path().resource_dir() {
        roots.push(res.clone());
        candidates.push(res.join("frontend-dist"));
        candidates.push(res.join("resources").join("frontend-dist"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            roots.push(dir.to_path_buf());
            candidates.push(dir.join("frontend-dist"));
        }
    }
    candidates.push(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("frontend")
            .join("dist"),
    );
    // Whatever a bundler decides to do with a directory resource, the built UI
    // is somewhere under the install dir — so look for it instead of assuming.
    for root in roots {
        collect_dist_dirs(&root, 0, &mut candidates);
    }
    candidates.into_iter().find(|p| looks_built(p))
}

/// Depth-limited walk for `frontend-dist` folders (bundlers nest resources
/// differently per platform; the shell should not care which one it is).
fn collect_dist_dirs(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 3 {
        return;
    }
    if dir.join("index.html").is_file() && dir.file_name().map(|n| n == "frontend-dist").unwrap_or(false) {
        out.push(dir.to_path_buf());
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_dist_dirs(&path, depth + 1, out);
        }
    }
}

#[cfg(windows)]
fn quiet(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW — the sidecar is a console-shaped program; the user
    // should never see its window.
    cmd.creation_flags(0x0800_0000);
}
#[cfg(not(windows))]
fn quiet(_cmd: &mut Command) {}

fn spawn_sidecar(path: &Path, frontend: Option<&Path>) -> std::io::Result<Child> {
    let mut cmd = Command::new(path);
    cmd.arg("serve").arg("--port").arg(port().to_string());
    cmd.env("RE_HOST", "127.0.0.1");
    // Tell the server it is running inside the shell: it changes which update
    // path is correct (the app cannot replace its own running binary, so the
    // shell fetches the installer instead).
    cmd.env("RE_SHELL", "desktop");
    if let Some(dir) = frontend {
        cmd.env("FRONTEND_DIST", dir);
    }
    cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    quiet(&mut cmd);
    cmd.spawn()
}

/// Shown only if the local server could not be started at all — better than
/// dropping the user on the webview's own error page.
fn offline_page(reason: &str) -> String {
    format!(
        "data:text/html;charset=utf-8,{}",
        urlencode(&format!(
            "<!doctype html><meta charset=utf-8><title>Research Engine</title>\
             <body style=\"margin:0;height:100vh;display:grid;place-items:center;background:#0b0d12;color:#e7e9ee;\
             font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif\">\
             <div style=\"max-width:520px;padding:32px\">\
             <h1 style=\"font-size:20px;margin:0 0 8px\">Research Engine could not start its local server</h1>\
             <p style=\"opacity:.75;margin:0 0 16px\">{}</p>\
             <p style=\"opacity:.6;font-size:13px\">The desktop app keeps everything on this machine, so it needs \
             its bundled server running on 127.0.0.1:{}. Close the app and open it again — if it keeps \
             happening, the port may already be in use by another program.</p></div></body>",
            reason,
            port()
        ))
    )
}

/// Percent-encode for a data: URL — keeps quotes and angle brackets harmless.
fn urlencode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b' ' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

fn build_window(app: &tauri::AppHandle, url: WebviewUrl) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "main", url)
        .title("Research Engine")
        .inner_size(1280.0, 840.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .center()
        .build()?;
    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        .manage(Sidecar(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            let app_url = format!("http://127.0.0.1:{}/", port());

            // Boot off the UI thread: nothing blocks, and the window only
            // appears once there is a page to show.
            std::thread::spawn(move || {
                let mut failure = String::new();
                if health_ok() {
                    eprintln!("[re] reusing the local server already on port {}", port());
                } else {
                    match sidecar_path(&handle) {
                        Some(path) => {
                            eprintln!("[re] starting local server: {}", path.display());
                            match spawn_sidecar(&path, frontend_dist(&handle).as_deref()) {
                                Ok(child) => {
                                    if let Some(state) = handle.try_state::<Sidecar>() {
                                        *state.0.lock().unwrap() = Some(child);
                                    }
                                }
                                Err(e) => failure = format!("The bundled server could not be started ({}).", e),
                            }
                        }
                        None => failure = "The bundled server executable is missing from this install.".into(),
                    }
                }

                if failure.is_empty() {
                    let started = Instant::now();
                    while started.elapsed() < BOOT_TIMEOUT {
                        if health_ok() {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(200));
                    }
                    if !health_ok() {
                        failure = "The bundled server did not answer in time.".into();
                    }
                }

                let url = if failure.is_empty() {
                    match tauri::Url::parse(&app_url) {
                        Ok(u) => WebviewUrl::External(u),
                        Err(_) => {
                            failure = "The local address could not be parsed.".into();
                            WebviewUrl::External(tauri::Url::parse("about:blank").unwrap())
                        }
                    }
                } else {
                    eprintln!("[re] {}", failure);
                    match tauri::Url::parse(&offline_page(&failure)) {
                        Ok(u) => WebviewUrl::External(u),
                        Err(_) => WebviewUrl::External(tauri::Url::parse("about:blank").unwrap()),
                    }
                };
                if let Err(e) = build_window(&handle, url) {
                    eprintln!("[re] could not open the window: {e}");
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Research Engine");

    app.run(|handle, event| {
        // One process tree, one life: closing the app stops the server it
        // started, so nothing keeps holding the database or the port.
        if let RunEvent::Exit = event {
            if let Some(state) = handle.try_state::<Sidecar>() {
                if let Some(mut child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
    });
}
