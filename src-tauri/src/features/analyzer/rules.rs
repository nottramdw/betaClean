use serde::Deserialize;

use crate::features::junk::model::Safety;

const RULES: &str = include_str!("../../../rules/analyzer-rules.json");

#[derive(Debug, Clone, Deserialize)]
pub struct FileRule {
    pub id: String,
    pub label: String,
    pub os: String,
    pub path: String,
    pub safety: Safety,
    pub reason: String,
    pub action: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderRule {
    pub id: String,
    pub label: String,
    pub name: String,
    #[serde(default)]
    pub parent_marker: Option<String>,
    #[serde(default)]
    pub self_marker: Option<String>,
    pub safety: Safety,
    pub reason: String,
    pub action: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRule {
    pub id: String,
    pub label: String,
    pub under: String,
    pub extensions: Vec<String>,
    pub min_idle_days: u64,
    pub safety: Safety,
    pub reason: String,
    pub action: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyzerRules {
    pub files: Vec<FileRule>,
    pub folders: Vec<FolderRule>,
    pub extensions: Vec<ExtensionRule>,
}

pub fn load() -> Result<AnalyzerRules, String> {
    serde_json::from_str(RULES).map_err(|e| e.to_string())
}

impl FolderRule {
    pub fn matches(&self, dir: &std::path::Path) -> bool {
        let name_ok = dir
            .file_name()
            .is_some_and(|n| n.to_string_lossy() == self.name);
        name_ok
            && self
                .parent_marker
                .as_ref()
                .is_none_or(|m| dir.parent().is_some_and(|p| p.join(m).exists()))
            && self
                .self_marker
                .as_ref()
                .is_none_or(|m| dir.join(m).exists())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::fs;

    #[test]
    fn rules_parse_with_unique_ids() {
        let rules = load().unwrap();
        let ids: Vec<&str> = rules
            .files
            .iter()
            .map(|r| r.id.as_str())
            .chain(rules.folders.iter().map(|r| r.id.as_str()))
            .chain(rules.extensions.iter().map(|r| r.id.as_str()))
            .collect();
        let unique: HashSet<_> = ids.iter().collect();
        assert_eq!(unique.len(), ids.len());
        assert!(!rules.folders.is_empty());
    }

    #[test]
    fn folder_rule_requires_marker() {
        let root = std::env::temp_dir().join(format!("betaclean-rule-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let project = root.join("du-an");
        let build = project.join("target");
        fs::create_dir_all(&build).unwrap();
        let rule = load()
            .unwrap()
            .folders
            .into_iter()
            .find(|r| r.id == "dev-rust-target")
            .unwrap();
        assert!(!rule.matches(&build));
        fs::write(project.join("Cargo.toml"), b"[package]").unwrap();
        assert!(rule.matches(&build));
        fs::remove_dir_all(&root).unwrap();
    }
}
