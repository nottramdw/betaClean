use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Safety {
    AnToan,
    CanXemXet,
    ChiThongBao,
    KhongDongVao,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JunkRule {
    pub id: String,
    pub label: String,
    pub os: String,
    pub path: String,
    pub safety: Safety,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JunkLocation {
    pub id: String,
    pub label: String,
    pub path: String,
    pub safety: Safety,
    pub size: u64,
    pub file_count: u64,
    pub targets: Vec<String>,
}
