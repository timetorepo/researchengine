//! Research Engine mobile: the Rust plumbing that the WebView cannot do.
//!
//! R1 scope (docs/mobile/00, brief §13): app lifecycle, a quality/thermal
//! bridge surface, and the frame-log ring buffer the design of
//! docs/mobile/10-performance.md §3 commits to. Model engines, the companion
//! protocol and the SQLite library attach in R2/R5/R6 behind the `re-core`
//! facade; none of them belong in this file.

use re_core::frame_budget::Quality;
use std::sync::{Arc, Mutex};

/// The frame-log ring buffer (exportable from Settings -> Advanced in R8,
/// format stable from R1 so we can start collecting during the shell rounds).
#[derive(Clone)]
pub struct FrameLog {
    inner: Arc<Mutex<Ring>>,
}

pub struct Ring {
    cap: usize,
    buf: Vec<FrameEvent>,
    next: usize,
}

#[derive(Clone, Copy, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameEvent {
    pub t_ms: u64,
    pub dt_ms: f32,
    pub level: Level,
}

#[derive(Clone, Copy, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Level { Full, Lean, Minimum }

impl From<Quality> for Level {
    fn from(q: Quality) -> Self {
        match q { Quality::Full => Level::Full, Quality::Lean => Level::Lean, Quality::Minimum => Level::Minimum }
    }
}

impl FrameLog {
    pub fn new(cap: usize) -> Self {
        Self { inner: Arc::new(Mutex::new(Ring { cap, buf: Vec::new(), next: 0 })) }
    }
    pub fn push(&self, t_ms: u64, dt_ms: f32, level: Quality) {
        let mut g = self.inner.lock().expect("frame log poisoned");
        if g.buf.len() < g.cap { g.buf.push(FrameEvent { t_ms, dt_ms, level: level.into() }); }
        else { g.buf[g.next] = FrameEvent { t_ms, dt_ms, level: level.into() }; g.next = (g.next + 1) % g.cap; }
    }
    pub fn export_json(&self) -> String {
        let g = self.inner.lock().expect("frame log poisoned");
        serde_json::to_string(&g.buf).unwrap_or_else(|_| "[]".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log = FrameLog::new(1024 * 60); // ~60 min at 120 Hz, one event per frame
    let log_for_state = log.clone();
    tauri::Builder::default()
        .manage(log_for_state)
        .invoke_handler(tauri::generate_handler![
            quality_report,
            frame_log_len,
            haptic
        ])
        .run(tauri::generate_context!())
        .expect("error while running Research Engine mobile");
}

/// What the WebView asks when it wants the truth about the frame rate.
/// The JS governor drives the decisions in R1; from R2 the native sampler
/// (CADisplayLink / Choreographer) feeds this instead.
#[tauri::command]
fn quality_report(log: tauri::State<'_, FrameLog>) -> serde_json::Value {
    serde_json::json!({ "events": 0usize, "source": "r1-shell", "detail": log.export_json().len() })
}

#[tauri::command]
fn frame_log_len(log: tauri::State<'_, FrameLog>) -> usize {
    log.inner.lock().map(|g| g.buf.len()).unwrap_or(0)
}

/// Haptic bridge. On Android the WebView's navigator.vibrate covers the table
/// in docs/mobile/07; iOS lands in R3 against Core Haptics (the JS side calls
/// this command when present, and no-ops on unsupported builds).
#[tauri::command]
fn haptic(event: String, pattern: String) -> Result<(), String> {
    // Deliberate silence, not a fake success: the JS layer already degraded to
    // no haptics; this log line exists so R3 can see which events fire.
    println!("[re-mobile] haptic {event} ({pattern}) - native transport pending R3");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ring_buffer_wraps_and_keeps_capacity() {
        let log = FrameLog::new(4);
        for i in 0..10u64 { log.push(i * 8, 8.0 + i as f32 / 10.0, Quality::Full); }
        let g = log.inner.lock().unwrap();
        assert_eq!(g.buf.len(), 4);
        // newest entries overwrite oldest: buffer holds the last 4
        // appends filled slots 0..3 with events 0..3; events 4..9 then
        // overwrite slots 0,1,2,3,0,1 -> buffer holds [64, 72, 48, 56].
        assert_eq!(g.buf[3].t_ms, 7 * 8);
        drop(g);
        let j: serde_json::Value = serde_json::from_str(&log.export_json()).unwrap();
        assert_eq!(j.as_array().unwrap().len(), 4);
    }
}
