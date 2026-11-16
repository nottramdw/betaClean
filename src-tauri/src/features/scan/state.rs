use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct ScanState {
    current: Mutex<Arc<AtomicBool>>,
}

impl ScanState {
    pub fn begin(&self) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        *self.current.lock().unwrap_or_else(|e| e.into_inner()) = flag.clone();
        flag
    }

    pub fn cancel(&self) {
        self.current
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .store(true, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_marks_current_scan_only() {
        let state = ScanState::default();
        let first = state.begin();
        let second = state.begin();
        state.cancel();
        assert!(!first.load(Ordering::Relaxed));
        assert!(second.load(Ordering::Relaxed));
    }
}
