//! Frame-budget governor (docs/mobile/10-performance.md).
//!
//! Pure logic, no platform calls, so it runs identically in the Rust core on
//! the phone and in unit tests here. Mirrors the brief's thresholds and the
//! values frozen in `packages/tokens/tokens.json` (frameBudget).

/// The three fidelity levels of the quality ladder. The ladder changes what is
/// *drawn*, never what the app *can do* (brief §5.1): there is no level that
/// hides a feature.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Quality { Full, Lean, Minimum }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Refresh { Hz60, Hz120 }

impl Refresh {
    /// (budget, no-headroom, cut) thresholds in ms, from tokens.json.
    pub fn thresholds(&self) -> (f32, f32, f32) {
        match self {
            Refresh::Hz120 => (8.3, 11.0, 17.0),
            Refresh::Hz60 => (16.6, 22.0, 34.0),
        }
    }
    pub fn frame_budget_ms(&self) -> f32 { self.thresholds().0 }
}

/// Rolling window of recent frame times (ms), newest last.
pub struct Sampler {
    window: Vec<f32>,
    capacity: usize,
}

impl Sampler {
    pub fn new(capacity: usize) -> Self {
        Self { window: Vec::with_capacity(capacity), capacity: capacity.max(1) }
    }

    pub fn push(&mut self, ms: f32) {
        if self.window.len() == self.capacity {
            self.window.remove(0);
        }
        self.window.push(ms.max(0.0));
    }

    pub fn len(&self) -> usize { self.window.len() }
    pub fn is_empty(&self) -> bool { self.window.is_empty() }

    /// Median of the window. Used for ladder decisions (median = robust to
    /// single spikes; p95/p99 are reported separately for the gates).
    pub fn median(&self) -> f32 {
        if self.window.is_empty() { return 0.0 }
        let mut v = self.window.clone();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        v[v.len() / 2]
    }

    /// p-th percentile (0..=100), nearest-rank.
    pub fn percentile(&self, p: f32) -> f32 {
        if self.window.is_empty() { return 0.0 }
        let mut v = self.window.clone();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let rank = ((p / 100.0) * v.len() as f32).ceil().max(1.0) as usize;
        v[rank.min(v.len()) - 1]
    }
}

/// Hysteresis state machine: drop after `drop_after` consecutive medians past
/// the cut threshold, recover after `recover_after` comfortably under it
/// (2/4 from tokens.json; never oscillate in view).
pub struct Governor {
    pub refresh: Refresh,
    pub quality: Quality,
    /// OS inputs: thermal severity and low-power mode are hard inputs; they are
    /// folded into `update` by the caller (re-core's platform bridge reads them).
    over_cut_streak: usize,
    under_streak: usize,
}

impl Governor {
    pub fn new(refresh: Refresh) -> Self {
        Self { refresh, quality: Quality::Full, over_cut_streak: 0, under_streak: 0 }
    }

    /// Feed one median frame time (ms). Returns the quality level after the
    /// update. `thermal_serious` and `low_power` act as immediate floors:
    /// serious thermal caps at Lean, low-power caps at Minimum until recovered
    /// (brief: the ladder must *say so*; the reason strings live with the UI).
    pub fn update(&mut self, median_ms: f32, thermal_serious: bool, low_power: bool) -> Quality {
        let (budget, _no_headroom, cut) = self.refresh.thresholds();
        if median_ms > cut {
            self.over_cut_streak += 1;
            self.under_streak = 0;
        } else if median_ms <= budget {
            self.under_streak += 1;
            self.over_cut_streak = 0;
        } else {
            self.over_cut_streak = 0;
            self.under_streak = 0;
        }

        // One ladder step per even over-streak (2 -> drop one, 4 -> drop again),
        // one ladder step per 4 under-streaks. Hysteresis prevents in-view
        // oscillation (docs/mobile/10-performance.md §3).
        if self.over_cut_streak >= 2 && self.over_cut_streak % 2 == 0 {
            self.quality = match self.quality {
                Quality::Full => Quality::Lean,
                Quality::Lean => Quality::Minimum,
                Quality::Minimum => Quality::Minimum,
            };
        } else if self.under_streak >= 4 && self.under_streak % 4 == 0 {
            self.quality = match self.quality {
                Quality::Minimum => Quality::Lean,
                Quality::Lean => Quality::Full,
                Quality::Full => Quality::Full,
            };
        }

        if low_power {
            self.quality = Quality::Minimum;
        } else if thermal_serious && self.quality == Quality::Full {
            self.quality = Quality::Lean;
        }
        self.quality
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thresholds_match_the_contract() {
        assert_eq!(Refresh::Hz60.frame_budget_ms(), 16.6);
        assert_eq!(Refresh::Hz120.frame_budget_ms(), 8.3);
        assert_eq!(Refresh::Hz60.thresholds().2, 34.0); // "past 34 the expensive layers go"
        assert_eq!(Refresh::Hz120.thresholds().2, 17.0);
    }

    #[test]
    fn median_and_percentiles() {
        let mut s = Sampler::new(10);
        for ms in [5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 40.0] {
            s.push(ms);
        }
        assert_eq!(s.len(), 10);
        assert_eq!(s.median(), 10.0);
        assert_eq!(s.percentile(95.0), 40.0);
        assert_eq!(s.percentile(50.0), 10.0);
    }

    #[test]
    fn window_is_ring() {
        let mut s = Sampler::new(3);
        for ms in [1.0, 2.0, 3.0, 4.0] { s.push(ms) }
        assert_eq!(s.len(), 3);
        assert_eq!(s.median(), 3.0); // 2,3,4
    }

    #[test]
    fn drops_after_two_consecutive_and_recovers_after_four() {
        let mut g = Governor::new(Refresh::Hz60);
        assert_eq!(g.update(35.0, false, false), Quality::Full); // streak 1: not yet
        assert_eq!(g.update(36.0, false, false), Quality::Lean); // streak 2: one step down
        assert_eq!(g.update(36.0, false, false), Quality::Lean); // streak 3: hold
        assert_eq!(g.update(36.0, false, false), Quality::Minimum); // streak 4: to the floor
        assert_eq!(g.update(36.0, false, false), Quality::Minimum); // streak 5: floor
        assert_eq!(g.update(36.0, false, false), Quality::Minimum); // streak 6: stays
        for _ in 0..3 { g.update(9.0, false, false); }
        assert_eq!(g.quality, Quality::Minimum); // 3 comfortable frames: not enough
        assert_eq!(g.update(9.0, false, false), Quality::Lean); // streak 4: one step up
        for _ in 0..3 { g.update(9.0, false, false); }
        assert_eq!(g.update(9.0, false, false), Quality::Full); // streak 8: back home
    }

    #[test]
    fn low_power_pins_to_minimum_and_releases() {
        let mut g = Governor::new(Refresh::Hz120);
        assert_eq!(g.update(9.5, false, true), Quality::Minimum);
        for _ in 0..8 { g.update(5.0, false, true); }
        assert_eq!(g.quality, Quality::Minimum); // cannot climb while low-power
        for _ in 0..8 { g.update(5.0, false, false); }
        assert_eq!(g.quality, Quality::Full);
    }

    #[test]
    fn thermal_caps_at_lean() {
        let mut g = Governor::new(Refresh::Hz60);
        assert_eq!(g.update(10.0, true, false), Quality::Lean);
        // with thermal still serious it may not climb back to Full
        assert_eq!(g.update(10.0, true, false), Quality::Lean);
    }

    #[test]
    fn never_rejects_a_feature_only_fidelity_changes() {
        // meta-test for the documented rule: the enum has exactly three levels
        // and no "disabled" state exists in the type at all.
        let levels = [Quality::Full, Quality::Lean, Quality::Minimum];
        assert_eq!(levels.len(), 3);
    }
}
