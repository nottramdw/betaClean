use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::time::UNIX_EPOCH;

use super::model::{AntivirusStatus, Engine, Threat, VirusScanOptions, VirusScanResult};
use super::process;

pub const BUNDLED_DIR: &str = "clamav";
pub const DATABASE_DIR: &str = "clamav-db";
const MIRROR: &str = "database.clamav.net";

fn executable(name: &str) -> String {
    format!("{name}{}", std::env::consts::EXE_SUFFIX)
}

fn known_dirs() -> Vec<PathBuf> {
    if cfg!(windows) {
        std::env::var("ProgramFiles")
            .map(|p| vec![PathBuf::from(p).join("ClamAV")])
            .unwrap_or_default()
    } else {
        vec![
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/usr/bin"),
        ]
    }
}

pub fn locate(name: &str, bundled: Option<&Path>) -> Option<PathBuf> {
    let file = executable(name);
    let path_dirs = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect::<Vec<_>>())
        .unwrap_or_default();
    bundled
        .map(Path::to_path_buf)
        .into_iter()
        .chain(path_dirs)
        .chain(known_dirs())
        .map(|dir| dir.join(&file))
        .find(|p| p.is_file())
}

pub fn certs_dir(executable: &Path) -> Option<PathBuf> {
    executable
        .parent()
        .map(|dir| dir.join("certs"))
        .filter(|dir| dir.is_dir())
}

fn with_certs(cmd: &mut std::process::Command, executable: &Path) {
    if let Some(dir) = certs_dir(executable) {
        cmd.arg(format!("--cvdcertsdir={}", dir.display()));
    }
}

pub fn locate_defender() -> Option<PathBuf> {
    if !cfg!(windows) {
        return None;
    }
    std::env::var("ProgramFiles")
        .ok()
        .map(|p| {
            PathBuf::from(p)
                .join("Windows Defender")
                .join("MpCmdRun.exe")
        })
        .filter(|p| p.is_file())
}

fn database_updated(db_dir: &Path) -> Option<u64> {
    fs::read_dir(db_dir)
        .ok()?
        .flatten()
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            name.ends_with(".cvd") || name.ends_with(".cld")
        })
        .filter_map(|e| e.metadata().ok()?.modified().ok())
        .filter_map(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .max()
}

pub fn database_ready(db_dir: &Path) -> bool {
    ["main", "daily"].iter().all(|base| {
        ["cvd", "cld"]
            .iter()
            .any(|ext| db_dir.join(format!("{base}.{ext}")).is_file())
    })
}

pub fn status(bundled: Option<&Path>, db_dir: &Path) -> AntivirusStatus {
    let display = |p: Option<PathBuf>| p.map(|p| p.to_string_lossy().into_owned());
    AntivirusStatus {
        clamscan: display(locate("clamscan", bundled)),
        freshclam: display(locate("freshclam", bundled)),
        defender: display(locate_defender()),
        database_dir: db_dir.to_string_lossy().into_owned(),
        database_ready: database_ready(db_dir),
        database_updated: database_updated(db_dir),
    }
}

pub fn update_database(
    bundled: Option<&Path>,
    db_dir: &Path,
    stop: &AtomicBool,
) -> Result<String, String> {
    let freshclam = locate("freshclam", bundled).ok_or("Không tìm thấy freshclam.")?;
    fs::create_dir_all(db_dir).map_err(|e| e.to_string())?;
    let config = db_dir.join("freshclam.conf");
    fs::write(
        &config,
        format!(
            "DatabaseDirectory {}\nDatabaseMirror {MIRROR}\n",
            db_dir.display()
        ),
    )
    .map_err(|e| e.to_string())?;
    let mut cmd = process::command(&freshclam);
    cmd.arg(format!("--config-file={}", config.display()))
        .arg(format!("--datadir={}", db_dir.display()))
        .arg("--quiet");
    with_certs(&mut cmd, &freshclam);
    let output = process::run(cmd, stop)?;
    if output.code == 0 {
        Ok(output.stdout)
    } else {
        Err(format!(
            "freshclam lỗi ({}): {}{}",
            output.code, output.stdout, output.stderr
        ))
    }
}

pub fn parse_clamscan(stdout: &str) -> Vec<Threat> {
    stdout
        .lines()
        .filter_map(|line| line.trim_end().strip_suffix(" FOUND"))
        .filter_map(|line| line.rsplit_once(": "))
        .map(|(path, name)| Threat {
            path: path.to_string(),
            name: name.to_string(),
            engine: Engine::Clamav,
        })
        .collect()
}

pub fn parse_defender(stdout: &str) -> Vec<Threat> {
    let mut threats = Vec::new();
    let mut current = None;
    for line in stdout.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let value = value.trim();
        match key.trim() {
            "Threat" => current = Some(value.to_string()),
            "file" => {
                if let Some(name) = &current {
                    threats.push(Threat {
                        path: value.to_string(),
                        name: name.clone(),
                        engine: Engine::Defender,
                    });
                }
            }
            _ => {}
        }
    }
    threats
}

fn scan_clamav(
    clamscan: &Path,
    db_dir: &Path,
    paths: &[String],
    stop: &AtomicBool,
) -> Result<Vec<Threat>, String> {
    if !database_ready(db_dir) {
        return Err("CSDL ClamAV chưa sẵn sàng, cần cập nhật khi có mạng.".to_string());
    }
    let mut cmd = process::command(clamscan);
    cmd.args(["-r", "--infected", "--no-summary", "--stdout"])
        .arg(format!("--database={}", db_dir.display()));
    with_certs(&mut cmd, clamscan);
    cmd.args(paths);
    let output = process::run(cmd, stop)?;
    let threats = parse_clamscan(&output.stdout);
    match output.code {
        0 | 1 => Ok(threats),
        code if threats.is_empty() && has_fatal_error(&output.stderr) => {
            Err(format!("clamscan lỗi ({code}): {}", output.stderr.trim()))
        }
        _ => Ok(threats),
    }
}

pub fn has_fatal_error(stderr: &str) -> bool {
    stderr
        .lines()
        .map(str::trim)
        .any(|line| line.starts_with("ERROR:") || line.starts_with("LibClamAV Error:"))
}

fn scan_defender(
    defender: &Path,
    paths: &[String],
    stop: &AtomicBool,
) -> Result<Vec<Threat>, String> {
    let mut threats = Vec::new();
    for path in paths {
        let mut cmd = process::command(defender);
        cmd.args(["-Scan", "-ScanType", "3", "-File"])
            .arg(path)
            .arg("-DisableRemediation");
        let output = process::run(cmd, stop)?;
        match output.code {
            0 | 2 => threats.extend(parse_defender(&output.stdout)),
            code => return Err(format!("Defender lỗi ({code}): {}", output.stdout.trim())),
        }
    }
    Ok(threats)
}

pub fn scan(
    options: &VirusScanOptions,
    bundled: Option<&Path>,
    db_dir: &Path,
    stop: &AtomicBool,
) -> Result<VirusScanResult, String> {
    let paths: Vec<String> = options
        .paths
        .iter()
        .filter(|p| Path::new(p).exists())
        .cloned()
        .collect();
    if paths.is_empty() {
        return Err("Không có đường dẫn hợp lệ để quét.".to_string());
    }
    let engines = options
        .engines
        .clone()
        .unwrap_or_else(|| vec![Engine::Clamav, Engine::Defender]);
    let mut result = VirusScanResult::default();
    for engine in engines {
        let outcome = match engine {
            Engine::Clamav => match locate("clamscan", bundled) {
                Some(clamscan) => scan_clamav(&clamscan, db_dir, &paths, stop),
                None => Err("Không tìm thấy clamscan.".to_string()),
            },
            Engine::Defender => match locate_defender() {
                Some(defender) => scan_defender(&defender, &paths, stop),
                None => continue,
            },
        };
        match outcome {
            Ok(threats) => {
                result.engines_used.push(engine);
                result.threats.extend(threats);
            }
            Err(e) if e == "Đã huỷ quét." => return Err(e),
            Err(e) => result.errors.push(e),
        }
    }
    if result.engines_used.is_empty() && !result.errors.is_empty() {
        return Err(result.errors.join(" "));
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    #[test]
    fn locked_files_are_not_fatal() {
        let stderr = "LibClamAV Warning: Can't open file C:\\pagefile.sys: 32\nWARNING: Can't open file C:\\pagefile.sys: Invalid argument\n";
        assert!(!super::has_fatal_error(stderr));
        assert!(super::has_fatal_error(
            "LibClamAV Error: cli_loaddb(): No supported database files found\n"
        ));
        assert!(super::has_fatal_error(
            "ERROR: Can't initialize the internal logger\n"
        ));
    }

    use super::*;

    #[test]
    fn parses_clamscan_output() {
        let out = "C:\\a\\eicar.com: Win.Test.EICAR_HDB-1 FOUND\n/tmp/x: y: Unix.Trojan.Foo-2 FOUND\n/tmp/ok: OK\n";
        let threats = parse_clamscan(out);
        assert_eq!(threats.len(), 2);
        assert_eq!(threats[0].path, "C:\\a\\eicar.com");
        assert_eq!(threats[0].name, "Win.Test.EICAR_HDB-1");
        assert_eq!(threats[1].path, "/tmp/x: y");
    }

    #[test]
    fn parses_defender_output() {
        let out = "Scan starting...\nScan finished.\nScanning C:\\test found 2 threats.\n\n\
<===========================LIST OF DETECTED THREATS==========================>\n\
----------------------------- Threat information ------------------------------\n\
Threat                  : Virus:DOS/EICAR_Test_File\n\
Resources               : 2 total\n\
    file                : C:\\test\\eicar.com\n\
    file                : C:\\test\\eicar2.com\n\
-------------------------------------------------------------------------------\n";
        let threats = parse_defender(out);
        assert_eq!(threats.len(), 2);
        assert_eq!(threats[1].path, "C:\\test\\eicar2.com");
        assert_eq!(threats[0].name, "Virus:DOS/EICAR_Test_File");
    }

    #[test]
    fn clean_defender_output_has_no_threats() {
        let out = "Scan starting...\nScan finished.\nScanning C:\\a.txt found no threats.\n";
        assert!(parse_defender(out).is_empty());
    }

    #[test]
    fn database_requires_main_and_daily() {
        let dir = std::env::temp_dir().join(format!("betaclean-av-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("main.cvd"), b"x").unwrap();
        assert!(!database_ready(&dir));
        fs::write(dir.join("daily.cld"), b"x").unwrap();
        assert!(database_ready(&dir));
        assert!(database_updated(&dir).is_some());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_missing_scan_paths() {
        let options = VirusScanOptions {
            paths: vec!["/khong/ton/tai/betaclean".to_string()],
            engines: None,
        };
        assert!(scan(&options, None, Path::new("."), &AtomicBool::new(false)).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn defender_scans_clean_file() {
        let Some(defender) = locate_defender() else {
            return;
        };
        let file = std::env::temp_dir().join(format!("betaclean-clean-{}.txt", std::process::id()));
        fs::write(&file, b"betaclean").unwrap();
        let result = scan_defender(
            &defender,
            &[file.to_string_lossy().into_owned()],
            &AtomicBool::new(false),
        );
        fs::remove_file(&file).unwrap();
        assert_eq!(result.unwrap(), Vec::new());
    }
}
