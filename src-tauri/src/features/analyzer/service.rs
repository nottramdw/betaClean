use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use crossbeam_channel::Sender;
use czkawka_core::common::progress_data::ProgressData;

use super::model::{AnalysisReport, AnalyzeOptions, Category, Finding, Hotspot};
use super::rules::{self, AnalyzerRules, ExtensionRule};
use super::volumes;
use super::walker::{Walk, drill};
use crate::features::junk::model::{JunkLocation, Safety};
use crate::features::junk::service as junk;
use crate::features::unused::service::{now, report};
use crate::shared::disk_size;

const DAY: u64 = 86_400;
const DEFAULT_UNUSED_DAYS: u64 = 180;
const HOTSPOT_LIMIT: usize = 20;
const HOTSPOT_MIN: u64 = 50 * 1024 * 1024;

pub fn safety_weight(safety: Safety) -> f64 {
    match safety {
        Safety::AnToan => 1.0,
        Safety::CanXemXet => 0.6,
        Safety::ChiThongBao => 0.3,
        Safety::KhongDongVao => 0.0,
    }
}

pub fn score(size: u64, safety: Safety, idle_days: Option<u64>) -> f64 {
    let megabytes = size as f64 / (1024.0 * 1024.0);
    let idle = idle_days.unwrap_or(0).min(365) as f64 / 365.0;
    let value = (1.0 + megabytes).log2() * safety_weight(safety) * (1.0 + idle);
    (value * 100.0).round() / 100.0
}

fn idle_days(last_used: u64, at: u64) -> u64 {
    at.saturating_sub(last_used) / DAY
}

fn text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn default_roots() -> Vec<PathBuf> {
    junk::system_variable("home")
        .map(PathBuf::from)
        .into_iter()
        .collect()
}

fn location_text(safety: Safety) -> (&'static str, &'static str) {
    match safety {
        Safety::AnToan => (
            "Bộ nhớ đệm và tệp tạm do hệ điều hành hoặc ứng dụng tự sinh lại.",
            "Chuyển nội dung bên trong vào Thùng rác.",
        ),
        Safety::CanXemXet => (
            "Có thể chứa dữ liệu người dùng còn cần.",
            "Xem lại nội dung trước khi chuyển Thùng rác.",
        ),
        _ => (
            "Vị trí do hệ thống quản lý.",
            "Dùng công cụ dọn dẹp của hệ điều hành.",
        ),
    }
}

fn location_finding(location: JunkLocation) -> Finding {
    let (reason, action) = location_text(location.safety);
    Finding {
        score: score(location.size, location.safety, None),
        id: location.id,
        title: location.label,
        path: location.path,
        size: location.size,
        safety: location.safety,
        category: Category::ViTriRac,
        reason: reason.to_string(),
        action: action.to_string(),
        idle_days: None,
        targets: location.targets,
    }
}

fn system_file_findings(rules: &AnalyzerRules) -> Vec<Finding> {
    rules
        .files
        .iter()
        .filter(|r| r.os == std::env::consts::OS)
        .filter_map(|r| {
            let path = junk::resolve_path(&r.path, junk::system_variable)?;
            let size = disk_size::of_path(&path)?;
            Some(Finding {
                id: r.id.clone(),
                title: r.label.clone(),
                path: text(&path),
                size,
                safety: r.safety,
                category: Category::TepHeThong,
                reason: r.reason.clone(),
                action: r.action.clone(),
                idle_days: None,
                targets: Vec::new(),
                score: score(size, r.safety, None),
            })
        })
        .collect()
}

fn resolved_extensions(rules: &AnalyzerRules) -> Vec<(ExtensionRule, PathBuf)> {
    rules
        .extensions
        .iter()
        .filter_map(|r| junk::resolve_path(&r.under, junk::system_variable).map(|p| (r.clone(), p)))
        .collect()
}

fn walk_findings(
    walk: &Walk,
    rules: &AnalyzerRules,
    extensions: &[(ExtensionRule, PathBuf)],
    unused_days: u64,
    at: u64,
) -> Vec<Finding> {
    let mut findings: Vec<Finding> = walk
        .folder_matches
        .iter()
        .filter(|m| m.size > 0)
        .map(|m| {
            let rule = &rules.folders[m.rule];
            let idle = idle_days(m.last_used, at);
            Finding {
                id: format!("{}:{}", rule.id, text(&m.path)),
                title: rule.label.clone(),
                path: text(&m.path),
                size: m.size,
                safety: rule.safety,
                category: Category::LapTrinh,
                reason: rule.reason.clone(),
                action: rule.action.clone(),
                idle_days: Some(idle),
                targets: vec![text(&m.path)],
                score: score(m.size, rule.safety, Some(idle)),
            }
        })
        .collect();

    for (index, (rule, under)) in extensions.iter().enumerate() {
        let hits: Vec<_> = walk
            .extension_matches
            .iter()
            .filter(|m| m.rule == index && idle_days(m.last_used, at) >= rule.min_idle_days)
            .collect();
        if hits.is_empty() {
            continue;
        }
        let size = hits.iter().map(|m| m.size).sum();
        let idle = hits.iter().map(|m| idle_days(m.last_used, at)).min();
        findings.push(Finding {
            id: rule.id.clone(),
            title: rule.label.clone(),
            path: text(under),
            size,
            safety: rule.safety,
            category: Category::TaiVe,
            reason: rule.reason.clone(),
            action: rule.action.clone(),
            idle_days: idle,
            targets: hits.iter().map(|m| text(&m.path)).collect(),
            score: score(size, rule.safety, idle),
        });
    }

    let claimed: HashSet<&Path> = walk
        .extension_matches
        .iter()
        .map(|m| m.path.as_path())
        .collect();
    findings.extend(
        walk.large_files
            .iter()
            .filter(|f| !claimed.contains(f.path.as_path()))
            .filter_map(|f| {
                let idle = idle_days(f.last_used, at);
                (idle >= unused_days).then(|| Finding {
                    id: format!("lau-khong-dung:{}", text(&f.path)),
                    title: f
                        .path
                        .file_name()
                        .map_or_else(|| text(&f.path), |n| n.to_string_lossy().into_owned()),
                    path: text(&f.path),
                    size: f.size,
                    safety: Safety::CanXemXet,
                    category: Category::LauKhongDung,
                    reason: format!("Tệp lớn không được mở hoặc sửa trong {idle} ngày."),
                    action: "Xem lại; chuyển Thùng rác hoặc sao lưu ra ổ ngoài.".to_string(),
                    idle_days: Some(idle),
                    targets: vec![text(&f.path)],
                    score: score(f.size, Safety::CanXemXet, Some(idle)),
                })
            }),
    );
    findings
}

pub fn rank(findings: &mut Vec<Finding>) {
    let mut seen = HashSet::new();
    findings.retain(|f| seen.insert(f.path.to_lowercase()) || f.category == Category::TaiVe);
    findings.sort_by(|a, b| b.score.total_cmp(&a.score).then(b.size.cmp(&a.size)));
}

pub fn analyze(
    options: &AnalyzeOptions,
    stop: &AtomicBool,
    progress: Option<&Sender<ProgressData>>,
) -> Result<AnalysisReport, String> {
    let rules = rules::load()?;
    let at = now();
    let roots: Vec<PathBuf> = if options.paths.is_empty() {
        default_roots()
    } else {
        options.paths.iter().map(PathBuf::from).collect()
    };
    let roots: Vec<PathBuf> = roots.into_iter().filter(|p| p.is_dir()).collect();
    if roots.is_empty() {
        return Err("Không có thư mục hợp lệ để quét.".to_string());
    }

    let locations: Vec<_> = junk::platform_rules()?
        .into_iter()
        .filter(|r| r.safety != Safety::KhongDongVao)
        .collect();
    let mut findings: Vec<Finding> = junk::scan_locations(&locations, stop)?
        .into_iter()
        .filter(|l| l.size > 0)
        .map(location_finding)
        .collect();
    findings.extend(system_file_findings(&rules));

    let extensions = resolved_extensions(&rules);
    let on_progress = |count: usize| report(progress, count);
    let excluded = options.excluded.iter().map(PathBuf::from).collect();
    let mut walk = Walk::new(&rules.folders, &extensions, stop, &on_progress).exclude(excluded);
    let mut scanned_bytes = 0u64;
    let mut totals = Vec::new();
    for root in &roots {
        let size = walk.run(root);
        scanned_bytes += size;
        totals.push((root.clone(), size));
    }
    if stop.load(Ordering::Relaxed) {
        return Err("Đã huỷ quét.".to_string());
    }

    let unused_days = options.unused_days.unwrap_or(DEFAULT_UNUSED_DAYS);
    let location_paths: Vec<PathBuf> = findings.iter().map(|f| PathBuf::from(&f.path)).collect();
    findings.extend(
        walk_findings(&walk, &rules, &extensions, unused_days, at)
            .into_iter()
            .filter(|f| {
                f.category != Category::LauKhongDung
                    || !location_paths
                        .iter()
                        .any(|l| Path::new(&f.path).starts_with(l))
            }),
    );
    rank(&mut findings);

    let mut hotspots: Vec<Hotspot> = totals
        .iter()
        .flat_map(|(root, size)| {
            drill(
                &walk.children,
                root,
                (size / 50).max(HOTSPOT_MIN),
                HOTSPOT_LIMIT,
            )
        })
        .map(|node| Hotspot {
            share: if scanned_bytes == 0 {
                0.0
            } else {
                node.size as f64 / scanned_bytes as f64
            },
            path: text(&node.path),
            size: node.size,
            is_dir: node.is_dir,
        })
        .collect();
    hotspots.sort_by_key(|h| std::cmp::Reverse(h.size));
    hotspots.truncate(HOTSPOT_LIMIT);

    let sum = |safety: Safety| -> u64 {
        findings
            .iter()
            .filter(|f| f.safety == safety)
            .map(|f| f.size)
            .sum()
    };
    Ok(AnalysisReport {
        generated_at: at,
        volumes: volumes::list(),
        roots: roots.iter().map(|r| text(r)).collect(),
        scanned_bytes,
        reclaimable_safe: sum(Safety::AnToan),
        reclaimable_review: sum(Safety::CanXemXet),
        findings,
        hotspots,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn finding(path: &str, size: u64, safety: Safety, category: Category) -> Finding {
        Finding {
            id: path.to_string(),
            title: path.to_string(),
            path: path.to_string(),
            size,
            safety,
            category,
            reason: String::new(),
            action: String::new(),
            idle_days: None,
            targets: Vec::new(),
            score: score(size, safety, None),
        }
    }

    #[test]
    fn score_prefers_safe_large_and_idle() {
        let gb = 1024 * 1024 * 1024;
        assert!(score(gb, Safety::AnToan, None) > score(gb, Safety::CanXemXet, None));
        assert!(score(gb, Safety::CanXemXet, None) > score(gb, Safety::ChiThongBao, None));
        assert!(score(2 * gb, Safety::AnToan, None) > score(gb, Safety::AnToan, None));
        assert!(score(gb, Safety::CanXemXet, Some(365)) > score(gb, Safety::CanXemXet, Some(10)));
        assert_eq!(score(gb, Safety::KhongDongVao, None), 0.0);
    }

    #[test]
    fn rank_orders_by_score_and_removes_duplicates() {
        let mb = 1024 * 1024;
        let mut findings = vec![
            finding("/a", 10 * mb, Safety::ChiThongBao, Category::TepHeThong),
            finding("/b", 10 * mb, Safety::AnToan, Category::ViTriRac),
            finding("/B", 10 * mb, Safety::AnToan, Category::LapTrinh),
        ];
        rank(&mut findings);
        assert_eq!(findings.len(), 2);
        assert_eq!(findings[0].path, "/b");
    }

    #[test]
    fn analyze_reports_dev_folders_and_hotspots() {
        let base = std::env::temp_dir().join(format!("betaclean-analyze-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let modules = base.join("web").join("node_modules");
        fs::create_dir_all(&modules).unwrap();
        fs::write(base.join("web").join("package.json"), b"{}").unwrap();
        fs::write(modules.join("lib.js"), vec![0u8; 4096]).unwrap();
        let options = AnalyzeOptions {
            paths: vec![text(&base)],
            ..Default::default()
        };
        let result = analyze(&options, &AtomicBool::new(false), None).unwrap();
        fs::remove_dir_all(&base).unwrap();
        assert_eq!(result.scanned_bytes, 4098);
        let dev = result
            .findings
            .iter()
            .find(|f| f.category == Category::LapTrinh)
            .unwrap();
        assert_eq!(dev.size, 4096);
        assert!(dev.path.ends_with("node_modules"));
        assert!(!result.volumes.is_empty());
    }
}
