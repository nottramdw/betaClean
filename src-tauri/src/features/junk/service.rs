use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use super::model::{JunkLocation, JunkRule};

const RULES: &str = include_str!("../../../rules/junk-locations.json");

pub fn all_rules() -> Result<Vec<JunkRule>, String> {
    serde_json::from_str(RULES).map_err(|e| e.to_string())
}

pub fn platform_rules() -> Result<Vec<JunkRule>, String> {
    Ok(all_rules()?
        .into_iter()
        .filter(|r| r.os == std::env::consts::OS)
        .collect())
}

pub fn system_variable(name: &str) -> Option<String> {
    let value = match name {
        "home" => std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .ok(),
        "temp" => Some(std::env::temp_dir().to_string_lossy().into_owned()),
        "localappdata" => std::env::var("LOCALAPPDATA").ok(),
        "appdata" => std::env::var("APPDATA").ok(),
        "programdata" => std::env::var("ProgramData").ok(),
        "windir" => std::env::var("WINDIR").ok(),
        "systemdrive" => std::env::var("SystemDrive").ok().map(|d| format!("{d}/")),
        _ => None,
    };
    value.filter(|v| !v.is_empty())
}

pub fn resolve_path(template: &str, lookup: impl Fn(&str) -> Option<String>) -> Option<PathBuf> {
    let mut resolved = String::new();
    let mut rest = template;
    while let Some(start) = rest.find('{') {
        let end = rest[start..].find('}')? + start;
        resolved.push_str(&rest[..start]);
        resolved.push_str(&lookup(&rest[start + 1..end])?);
        rest = &rest[end + 1..];
    }
    resolved.push_str(rest);
    let mut path = PathBuf::new();
    for part in resolved.split(['/', '\\']).filter(|p| !p.is_empty()) {
        if path.as_os_str().is_empty() && resolved.starts_with(['/', '\\']) {
            path.push(std::path::MAIN_SEPARATOR_STR);
        }
        if path.as_os_str().is_empty() && part.ends_with(':') {
            path.push(format!("{part}{}", std::path::MAIN_SEPARATOR));
        } else {
            path.push(part);
        }
    }
    Some(path)
}

pub fn dir_usage(root: &Path, stop: &AtomicBool) -> (u64, u64) {
    let mut size = 0;
    let mut count = 0;
    let mut pending = vec![root.to_path_buf()];
    while let Some(dir) = pending.pop() {
        if stop.load(Ordering::Relaxed) {
            break;
        }
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if meta.is_dir() {
                pending.push(entry.path());
            } else if meta.is_file() {
                size += meta.len();
                count += 1;
            }
        }
    }
    (size, count)
}

pub fn scan_locations(rules: &[JunkRule], stop: &AtomicBool) -> Result<Vec<JunkLocation>, String> {
    let targets: Vec<(&JunkRule, PathBuf)> = rules
        .iter()
        .filter_map(|r| resolve_path(&r.path, system_variable).map(|p| (r, p)))
        .filter(|(_, p)| p.is_dir())
        .collect();
    let mut locations: Vec<JunkLocation> = std::thread::scope(|scope| {
        let handles: Vec<_> = targets
            .iter()
            .map(|(rule, path)| {
                scope.spawn(move || {
                    let (size, file_count) = dir_usage(path, stop);
                    JunkLocation {
                        id: rule.id.clone(),
                        label: rule.label.clone(),
                        path: path.to_string_lossy().into_owned(),
                        safety: rule.safety,
                        size,
                        file_count,
                    }
                })
            })
            .collect();
        handles.into_iter().filter_map(|h| h.join().ok()).collect()
    });
    if stop.load(Ordering::Relaxed) {
        return Err("Đã huỷ quét.".to_string());
    }
    locations.sort_by_key(|l| std::cmp::Reverse(l.size));
    Ok(locations)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn rules_are_valid_and_unique() {
        let rules = all_rules().unwrap();
        let ids: HashSet<_> = rules.iter().map(|r| r.id.as_str()).collect();
        assert_eq!(ids.len(), rules.len());
        assert!(rules.iter().all(|r| r.os == "windows" || r.os == "macos"));
        let known = [
            "home",
            "temp",
            "localappdata",
            "appdata",
            "programdata",
            "windir",
            "systemdrive",
        ];
        for rule in &rules {
            assert!(
                resolve_path(&rule.path, |n| known.contains(&n).then(|| "x".to_string())).is_some()
            );
        }
    }

    #[test]
    fn resolves_variables() {
        let path = resolve_path("{home}/Library/Caches", |n| {
            (n == "home").then(|| "/Users/a".to_string())
        })
        .unwrap();
        let expected: PathBuf = [
            std::path::MAIN_SEPARATOR_STR,
            "Users",
            "a",
            "Library",
            "Caches",
        ]
        .iter()
        .collect();
        assert_eq!(path, expected);
    }

    #[test]
    fn unknown_variable_skips_rule() {
        assert!(resolve_path("{khong-co}/x", |_| None).is_none());
        assert!(resolve_path("{home/x", |_| Some("a".to_string())).is_none());
    }

    #[test]
    fn measures_directory_usage() {
        let root = std::env::temp_dir().join(format!("betaclean-junk-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("a").join("b")).unwrap();
        fs::write(root.join("f1"), vec![0u8; 100]).unwrap();
        fs::write(root.join("a").join("b").join("f2"), vec![0u8; 50]).unwrap();
        let usage = dir_usage(&root, &AtomicBool::new(false));
        fs::remove_dir_all(&root).unwrap();
        assert_eq!(usage, (150, 2));
    }

    #[test]
    fn scans_current_platform_without_error() {
        let rules = platform_rules().unwrap();
        let locations = scan_locations(&rules, &AtomicBool::new(false)).unwrap();
        assert!(locations.windows(2).all(|w| w[0].size >= w[1].size));
    }
}
