use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[cfg(unix)]
use sysinfo::Signal;
use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use super::model::{AppUsage, MemoryReport};
use crate::features::cleanup::model::{CleanupReport, Failure};

const GRACE: Duration = Duration::from_secs(3);
const POLL: Duration = Duration::from_millis(200);
const NOT_CONFIRMED: &str = "Thao tác cần người dùng xác nhận.";
const SELF_REASON: &str = "Tiến trình của betaClean.";
const SYSTEM_REASON: &str = "Tiến trình hệ thống.";
const OTHER_USER_REASON: &str = "Tiến trình hệ thống hoặc của người dùng khác.";

const CRITICAL_NAMES: &[&str] = &[
    "kernel_task",
    "launchd",
    "windowserver",
    "loginwindow",
    "dock",
    "finder",
    "systemuiserver",
    "controlcenter",
    "system",
    "registry",
    "secure system",
    "memory compression",
    "memcompression",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "winlogon.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "dwm.exe",
    "explorer.exe",
    "fontdrvhost.exe",
    "sihost.exe",
    "ctfmon.exe",
    "taskhostw.exe",
    "runtimebroker.exe",
    "audiodg.exe",
    "spoolsv.exe",
    "msmpeng.exe",
    "startmenuexperiencehost.exe",
    "shellexperiencehost.exe",
    "searchhost.exe",
    "textinputhost.exe",
];

const SYSTEM_PREFIXES: &[&str] = &[
    "/system/library/",
    "/system/volumes/preboot/cryptexes/os/",
    "/usr/libexec/",
    "/usr/sbin/",
    "/sbin/",
    "/library/apple/",
    "c:\\windows\\",
];

#[derive(Default)]
pub struct Monitor {
    system: Mutex<Option<System>>,
}

fn refresh_kind() -> ProcessRefreshKind {
    ProcessRefreshKind::nothing()
        .with_memory()
        .with_cpu()
        .with_exe(UpdateKind::OnlyIfNotSet)
        .with_user(UpdateKind::OnlyIfNotSet)
}

pub fn outer_bundle(exe: &Path) -> Option<PathBuf> {
    let mut current = PathBuf::new();
    for part in exe.components() {
        current.push(part);
        if current
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("app"))
        {
            return Some(current);
        }
    }
    None
}

fn identity(process: &Process) -> (String, String, Option<String>) {
    let name = process.name().to_string_lossy().into_owned();
    let Some(exe) = process.exe() else {
        return (format!("name:{}", name.to_lowercase()), name, None);
    };
    let (path, label) = match outer_bundle(exe) {
        Some(bundle) => {
            let label = bundle
                .file_stem()
                .map_or_else(|| name.clone(), |s| s.to_string_lossy().into_owned());
            (bundle, label)
        }
        None => {
            let label = exe
                .file_stem()
                .map_or_else(|| name.clone(), |s| s.to_string_lossy().into_owned());
            (exe.to_path_buf(), label)
        }
    };
    let text = path.to_string_lossy().into_owned();
    (text.to_lowercase(), label, Some(text))
}

struct Context {
    own: HashSet<Pid>,
    user: Option<sysinfo::Uid>,
}

impl Context {
    fn new(system: &System) -> Self {
        let me = sysinfo::get_current_pid().ok();
        let user = me
            .and_then(|pid| system.process(pid))
            .and_then(|p| p.user_id())
            .cloned();
        let mut own: HashSet<Pid> = me.into_iter().collect();
        loop {
            let before = own.len();
            for (pid, process) in system.processes() {
                if process.parent().is_some_and(|parent| own.contains(&parent)) {
                    own.insert(*pid);
                }
            }
            if own.len() == before {
                break;
            }
        }
        Self { own, user }
    }

    fn protection(&self, pid: Pid, process: &Process) -> Option<&'static str> {
        if self.own.contains(&pid) {
            return Some(SELF_REASON);
        }
        let name = process.name().to_string_lossy().to_lowercase();
        let exe = process
            .exe()
            .map(|p| p.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if CRITICAL_NAMES.contains(&name.as_str())
            || SYSTEM_PREFIXES.iter().any(|prefix| exe.starts_with(prefix))
        {
            return Some(SYSTEM_REASON);
        }
        match (&self.user, process.user_id()) {
            (Some(mine), Some(theirs)) if mine == theirs => None,
            _ => Some(OTHER_USER_REASON),
        }
    }
}

#[cfg(target_os = "macos")]
fn request_close(process: &Process) -> bool {
    use objc2_app_kit::NSRunningApplication;
    let pid = process.pid().as_u32() as libc::pid_t;
    match NSRunningApplication::runningApplicationWithProcessIdentifier(pid) {
        Some(app) => app.terminate(),
        None => process.kill_with(Signal::Term).unwrap_or(false),
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn request_close(process: &Process) -> bool {
    process.kill_with(Signal::Term).unwrap_or(false)
}

#[cfg(windows)]
fn request_close(process: &Process) -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    std::process::Command::new("taskkill")
        .args(["/PID", &process.pid().as_u32().to_string()])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .is_ok_and(|out| out.status.success())
}

fn cores() -> f32 {
    std::thread::available_parallelism().map_or(1, |n| n.get()) as f32
}

impl Monitor {
    fn with_system<T>(&self, task: impl FnOnce(&mut System) -> T) -> Result<T, String> {
        let mut guard = self.system.lock().unwrap_or_else(|e| e.into_inner());
        if guard.is_none() {
            *guard = Some(System::new().map_err(|e| e.to_string())?);
        }
        Ok(task(guard.as_mut().expect("system initialised")))
    }

    fn refresh_all(system: &mut System) {
        system.refresh_memory();
        system.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind());
    }

    pub fn snapshot(&self) -> Result<MemoryReport, String> {
        self.with_system(|system| {
            Self::refresh_all(system);
            Self::report(system)
        })
    }

    fn report(system: &System) -> MemoryReport {
        let context = Context::new(system);
        let cores = cores();
        let mut groups: HashMap<String, AppUsage> = HashMap::new();
        for (pid, process) in system.processes() {
            let (id, name, path) = identity(process);
            let entry = groups.entry(id.clone()).or_insert_with(|| AppUsage {
                id,
                name,
                path,
                memory: 0,
                cpu: 0.0,
                pids: Vec::new(),
                protected: None,
            });
            entry.memory += process.memory();
            entry.cpu += process.cpu_usage() / cores;
            entry.pids.push(pid.as_u32());
            if entry.protected.is_none() {
                entry.protected = context.protection(*pid, process).map(str::to_string);
            }
        }
        let mut apps: Vec<AppUsage> = groups.into_values().filter(|a| a.memory > 0).collect();
        apps.sort_by_key(|a| std::cmp::Reverse(a.memory));
        MemoryReport {
            total: system.total_memory(),
            used: system.used_memory(),
            available: system.available_memory(),
            swap_total: system.total_swap(),
            swap_used: system.used_swap(),
            apps,
        }
    }

    pub fn terminate(
        &self,
        id: &str,
        pids: &[u32],
        force: bool,
        confirmed: bool,
    ) -> Result<CleanupReport, String> {
        if !confirmed {
            return Err(NOT_CONFIRMED.to_string());
        }
        let mut system = System::new().map_err(|e| e.to_string())?;
        system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing()
                .with_memory()
                .with_exe(UpdateKind::Always)
                .with_user(UpdateKind::Always),
        );
        let context = Context::new(&system);
        let mut report = CleanupReport::default();
        let mut waiting = Vec::new();
        for &raw in pids {
            let pid = Pid::from_u32(raw);
            let Some(process) = system.process(pid) else {
                continue;
            };
            if identity(process).0 != id {
                continue;
            }
            let label = format!("{} (PID {raw})", process.name().to_string_lossy());
            if let Some(reason) = context.protection(pid, process) {
                report.failed.push(Failure {
                    target: label,
                    error: reason.to_string(),
                });
                continue;
            }
            let follows_parent = process
                .parent()
                .is_some_and(|parent| pids.contains(&parent.as_u32()));
            let sent = if force {
                process.kill()
            } else {
                follows_parent || request_close(process)
            };
            if sent {
                waiting.push((pid, label, process.memory()));
            } else {
                report.failed.push(Failure {
                    target: label,
                    error: if force {
                        "Hệ điều hành từ chối yêu cầu dừng.".to_string()
                    } else {
                        "Tiến trình không nhận yêu cầu đóng; có thể buộc dừng.".to_string()
                    },
                });
            }
        }
        let deadline = Instant::now() + GRACE;
        loop {
            let targets: Vec<Pid> = waiting.iter().map(|(pid, _, _)| *pid).collect();
            system.refresh_processes_specifics(
                ProcessesToUpdate::Some(&targets),
                true,
                ProcessRefreshKind::nothing(),
            );
            waiting.retain(|(pid, label, memory)| {
                if system.process(*pid).is_some() {
                    return true;
                }
                report.succeeded.push(label.clone());
                report.bytes += memory;
                false
            });
            if waiting.is_empty() || Instant::now() >= deadline {
                break;
            }
            std::thread::sleep(POLL);
        }
        for (_, label, _) in waiting {
            report.failed.push(Failure {
                target: label,
                error: "Chưa thoát; ứng dụng có thể đang chờ lưu dữ liệu. Có thể buộc dừng."
                    .to_string(),
            });
        }
        Ok(report)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_helpers_under_outer_bundle() {
        let exe = Path::new(
            "/Applications/Google Chrome.app/Contents/Frameworks/Helper.app/Contents/MacOS/Helper",
        );
        assert_eq!(
            outer_bundle(exe),
            Some(PathBuf::from("/Applications/Google Chrome.app"))
        );
        assert_eq!(outer_bundle(Path::new("/usr/local/bin/node")), None);
    }

    #[test]
    fn own_process_is_listed_and_protected() {
        let monitor = Monitor::default();
        let report = monitor.snapshot().unwrap();
        assert!(report.total >= report.used);
        let me = std::process::id();
        let own = report.apps.iter().find(|a| a.pids.contains(&me)).unwrap();
        assert_eq!(own.protected.as_deref(), Some(SELF_REASON));
    }

    #[test]
    fn refuses_to_stop_itself() {
        let monitor = Monitor::default();
        let me = std::process::id();
        let report = monitor.snapshot().unwrap();
        let own = report.apps.iter().find(|a| a.pids.contains(&me)).unwrap();
        let result = monitor.terminate(&own.id, &[me], false, true).unwrap();
        assert!(result.succeeded.is_empty());
        assert_eq!(result.failed.len(), 1);
        assert!(monitor.terminate(&own.id, &[me], false, false).is_err());
    }

    #[test]
    fn skips_pid_that_belongs_to_another_app() {
        let monitor = Monitor::default();
        let result = monitor
            .terminate("name:khong-ton-tai", &[std::process::id()], true, true)
            .unwrap();
        assert!(result.succeeded.is_empty() && result.failed.is_empty());
    }
}
