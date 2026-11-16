use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Engine {
    Clamav,
    Defender,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AntivirusStatus {
    pub clamscan: Option<String>,
    pub freshclam: Option<String>,
    pub defender: Option<String>,
    pub database_dir: String,
    pub database_ready: bool,
    pub database_updated: Option<u64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VirusScanOptions {
    pub paths: Vec<String>,
    #[serde(default)]
    pub engines: Option<Vec<Engine>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Threat {
    pub path: String,
    pub name: String,
    pub engine: Engine,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VirusScanResult {
    pub threats: Vec<Threat>,
    pub engines_used: Vec<Engine>,
    pub errors: Vec<String>,
}
