use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUsage {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub memory: u64,
    pub cpu: f32,
    pub pids: Vec<u32>,
    pub protected: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryReport {
    pub total: u64,
    pub used: u64,
    pub available: u64,
    pub swap_total: u64,
    pub swap_used: u64,
    pub apps: Vec<AppUsage>,
}
