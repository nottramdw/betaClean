use serde::{Deserialize, Serialize};

use crate::features::junk::model::Safety;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeOptions {
    #[serde(default)]
    pub paths: Vec<String>,
    #[serde(default)]
    pub unused_days: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Volume {
    pub mount: String,
    pub total: u64,
    pub free: u64,
    pub used: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Category {
    ViTriRac,
    TepHeThong,
    LapTrinh,
    TaiVe,
    LauKhongDung,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub id: String,
    pub title: String,
    pub path: String,
    pub size: u64,
    pub safety: Safety,
    pub category: Category,
    pub reason: String,
    pub action: String,
    pub idle_days: Option<u64>,
    pub targets: Vec<String>,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hotspot {
    pub path: String,
    pub size: u64,
    pub share: f64,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisReport {
    pub generated_at: u64,
    pub volumes: Vec<Volume>,
    pub roots: Vec<String>,
    pub scanned_bytes: u64,
    pub findings: Vec<Finding>,
    pub hotspots: Vec<Hotspot>,
    pub reclaimable_safe: u64,
    pub reclaimable_review: u64,
}
