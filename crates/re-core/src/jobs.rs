//! The job queue (brief §3.1 "Jobs"): anything long is a job with a lifetime —
//! indexing, flood runs, exports, transcription. The queue is designed so
//! background limits *pause* work instead of killing it (Part 11 platform
//! rules): every state transition is durable, and resume is the norm.
//!
//! R1 ships the state machine and an in-memory runner; persistence to SQLite
//! lands with the library in R2 (the table is declared in schema_v2.sql then).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JobState { Queued, Running, Paused, Done, Failed, Cancelled }

impl JobState {
    pub fn is_terminal(self) -> bool { matches!(self, JobState::Done | JobState::Failed | JobState::Cancelled) }
    /// Legal transitions only. Cancel is allowed from any non-terminal state;
    /// a terminal job is immutable (sync treats completed records as
    /// append-only, brief §4.4).
    pub fn can_go(self, to: JobState) -> bool {
        use JobState::*;
        match self {
            Queued => matches!(to, Running | Cancelled),
            Running => matches!(to, Paused | Done | Failed | Cancelled),
            Paused => matches!(to, Running | Cancelled),
            Done | Failed | Cancelled => false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Job {
    pub id: u64,
    pub kind: String,
    pub state: JobState,
    /// 0.0..=1.0; None = indeterminate (progress is a *statement*, so the UI
    /// shows "working" with a sentence instead of a fake percentage).
    pub progress: Option<f32>,
    /// Monotonic checkpoint (e.g. "document 412 of 1204"); resume starts here.
    pub checkpoint: u64,
}

/// A queue the UI can drive from subscriptions only — no idle polling
/// (Part 5.2: "background work is a job with a lifetime, not a heartbeat").
pub struct Queue {
    jobs: Vec<Job>,
    next_id: u64,
    max_running: usize,
}

impl Queue {
    /// `max_running` mirrors the profile caps idea from the desktop
    /// (eco/balanced/performance → floodWorkers 1/2/4); mobile starts at the
    /// eco value and lets the platform bridge raise it.
    pub fn new(max_running: usize) -> Self {
        Self { jobs: Vec::new(), next_id: 1, max_running: max_running.max(1) }
    }

    pub fn submit(&mut self, kind: &str) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        self.jobs.push(Job { id, kind: kind.to_string(), state: JobState::Queued, progress: None, checkpoint: 0 });
        id
    }

    pub fn start_next(&mut self) -> Option<u64> {
        if self.running_count() >= self.max_running { return None }
        let job = self.jobs.iter_mut().find(|j| j.state == JobState::Queued)?;
        job.state = JobState::Running;
        Some(job.id)
    }

    fn get_mut(&mut self, id: u64) -> Option<&mut Job> { self.jobs.iter_mut().find(|j| j.id == id) }

    fn transition(&mut self, id: u64, to: JobState) -> bool {
        match self.get_mut(id) {
            Some(j) if j.state.can_go(to) => { j.state = to; true }
            _ => false,
        }
    }

    pub fn set_progress(&mut self, id: u64, progress: f32, checkpoint: u64) -> bool {
        match self.get_mut(id) {
            Some(j) if j.state == JobState::Running => {
                j.progress = Some(progress.clamp(0.0, 1.0));
                j.checkpoint = j.checkpoint.max(checkpoint);
                true
            }
            _ => false,
        }
    }

    pub fn pause(&mut self, id: u64) -> bool { self.transition(id, JobState::Paused) }
    pub fn resume(&mut self, id: u64) -> bool { self.transition(id, JobState::Running) }
    pub fn finish(&mut self, id: u64) -> bool { self.transition(id, JobState::Done) }
    pub fn fail(&mut self, id: u64) -> bool { self.transition(id, JobState::Failed) }
    pub fn cancel(&mut self, id: u64) -> bool { self.transition(id, JobState::Cancelled) }

    pub fn running_count(&self) -> usize { self.jobs.iter().filter(|j| j.state == JobState::Running).count() }
    pub fn snapshot(&self, id: u64) -> Option<&Job> { self.jobs.iter().find(|j| j.id == id) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lifecycle_happy_path() {
        let mut q = Queue::new(1);
        let a = q.submit("index");
        assert_eq!(q.start_next(), Some(a));
        assert!(q.set_progress(a, 0.5, 42));
        assert!(q.pause(a));
        assert_eq!(q.snapshot(a).unwrap().checkpoint, 42); // checkpoint survives pause
        assert!(q.resume(a));
        assert!(q.set_progress(a, 1.0, 100));
        assert!(q.finish(a));
        assert!(q.snapshot(a).unwrap().state.is_terminal());
    }

    #[test]
    fn concurrency_cap_honoured() {
        let mut q = Queue::new(1);
        let a = q.submit("flood");
        let _b = q.submit("export");
        assert!(q.start_next().is_some());
        assert!(q.start_next().is_none()); // cap = 1
        q.finish(a);
        assert!(q.start_next().is_some());
    }

    #[test]
    fn terminal_jobs_are_immutable() {
        let mut q = Queue::new(1);
        let a = q.submit("x");
        q.start_next();
        q.finish(a);
        assert!(!q.resume(a));
        assert!(!q.cancel(a));
        assert!(!q.set_progress(a, 0.1, 1));
    }

    #[test]
    fn cancel_allowed_from_every_live_state() {
        let mut q = Queue::new(4);
        let a = q.submit("x");
        assert!(q.cancel(a)); // from Queued
        let b = q.submit("y");
        q.start_next();
        assert!(q.cancel(b)); // from Running
        let c = q.submit("z");
        q.start_next();
        q.pause(c);
        assert!(q.cancel(c)); // from Paused
    }

    #[test]
    fn progress_clamped_and_checkpoint_monotonic() {
        let mut q = Queue::new(1);
        let a = q.submit("t");
        q.start_next();
        q.set_progress(a, 1.7, 10);
        assert_eq!(q.snapshot(a).unwrap().progress, Some(1.0));
        q.set_progress(a, 0.9, 5); // lower checkpoint ignored
        assert_eq!(q.snapshot(a).unwrap().checkpoint, 10);
    }
}
