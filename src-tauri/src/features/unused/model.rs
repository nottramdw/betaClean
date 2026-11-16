use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnusedOptions {
    pub paths: Vec<String>,
    #[serde(default)]
    pub excluded: Vec<String>,
    #[serde(default)]
    pub days: Option<u64>,
    #[serde(default)]
    pub min_size: Option<u64>,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TimeBasis {
    Accessed,
    Modified,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnusedFile {
    pub path: String,
    pub size: u64,
    pub last_used: u64,
    pub idle_days: u64,
    pub basis: TimeBasis,
}
