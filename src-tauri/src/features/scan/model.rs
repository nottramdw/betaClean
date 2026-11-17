use czkawka_core::common::progress_data::ProgressData;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    pub paths: Vec<String>,
    #[serde(default)]
    pub excluded: Vec<String>,
    #[serde(default)]
    pub min_size: Option<u64>,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub path: String,
    pub size: u64,
    pub modified: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub size: u64,
    pub hash: String,
    pub reclaimable: u64,
    pub files: Vec<DuplicateFile>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateFile {
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub storage: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderItem {
    pub path: String,
    pub modified: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub tool: &'static str,
    pub stage: String,
    pub checked: usize,
    pub total: usize,
    pub bytes_checked: u64,
    pub bytes_total: u64,
}

impl ScanProgress {
    pub fn from_data(tool: &'static str, data: &ProgressData) -> Self {
        Self {
            tool,
            stage: format!("{:?}", data.stage),
            checked: data.entries_checked,
            total: data.entries_to_check,
            bytes_checked: data.bytes_checked,
            bytes_total: data.bytes_to_check,
        }
    }
}
