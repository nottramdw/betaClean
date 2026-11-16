use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

pub struct Output {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

pub fn command(program: &std::path::Path) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd
}

fn drain(source: Option<impl Read + Send + 'static>) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(mut source) = source {
            let _ = source.read_to_end(&mut buffer);
        }
        String::from_utf8_lossy(&buffer).into_owned()
    })
}

pub fn run(mut cmd: Command, stop: &AtomicBool) -> Result<Output, String> {
    let mut child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Không chạy được tiến trình: {e}"))?;
    let stdout = drain(child.stdout.take());
    let stderr = drain(child.stderr.take());
    let status = loop {
        if stop.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Đã huỷ quét.".to_string());
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => std::thread::sleep(Duration::from_millis(100)),
            Err(e) => return Err(e.to_string()),
        }
    };
    Ok(Output {
        code: status.code().unwrap_or(-1),
        stdout: stdout.join().unwrap_or_default(),
        stderr: stderr.join().unwrap_or_default(),
    })
}
