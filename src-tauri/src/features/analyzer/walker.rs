use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use super::rules::{ExtensionRule, FolderRule};
use crate::features::unused::service::last_used;

pub const MAX_DEPTH: usize = 8;
const MIN_EXTENSION_FILE: u64 = 1024 * 1024;
pub const LARGE_FILE: u64 = 100 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct Node {
    pub path: PathBuf,
    pub size: u64,
    pub is_dir: bool,
}

#[derive(Debug, Clone)]
pub struct FolderMatch {
    pub rule: usize,
    pub path: PathBuf,
    pub size: u64,
    pub last_used: u64,
}

#[derive(Debug, Clone)]
pub struct ExtensionMatch {
    pub rule: usize,
    pub path: PathBuf,
    pub size: u64,
    pub last_used: u64,
}

#[derive(Debug, Clone)]
pub struct FileHit {
    pub path: PathBuf,
    pub size: u64,
    pub last_used: u64,
}

pub struct Walk<'a> {
    folders: &'a [FolderRule],
    extensions: &'a [(ExtensionRule, PathBuf)],
    stop: &'a AtomicBool,
    pub children: HashMap<PathBuf, Vec<Node>>,
    pub folder_matches: Vec<FolderMatch>,
    pub extension_matches: Vec<ExtensionMatch>,
    pub large_files: Vec<FileHit>,
    pub files_seen: usize,
    on_progress: &'a dyn Fn(usize),
}

impl<'a> Walk<'a> {
    pub fn new(
        folders: &'a [FolderRule],
        extensions: &'a [(ExtensionRule, PathBuf)],
        stop: &'a AtomicBool,
        on_progress: &'a dyn Fn(usize),
    ) -> Self {
        Self {
            folders,
            extensions,
            stop,
            children: HashMap::new(),
            folder_matches: Vec::new(),
            extension_matches: Vec::new(),
            large_files: Vec::new(),
            files_seen: 0,
            on_progress,
        }
    }

    pub fn run(&mut self, root: &Path) -> u64 {
        self.visit(root, 0, false).0
    }

    fn visit(&mut self, dir: &Path, depth: usize, claimed: bool) -> (u64, u64) {
        if self.stop.load(Ordering::Relaxed) {
            return (0, 0);
        }
        let matched = if claimed {
            None
        } else {
            self.folders.iter().position(|r| r.matches(dir))
        };
        let claimed = claimed || matched.is_some();
        let Ok(entries) = fs::read_dir(dir) else {
            return (0, 0);
        };
        let mut total = 0u64;
        let mut newest = 0u64;
        let mut nodes = Vec::new();
        for entry in entries.flatten() {
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            let path = entry.path();
            if kind.is_dir() {
                let (size, used) = self.visit(&path, depth + 1, claimed);
                total += size;
                newest = newest.max(used);
                if depth < MAX_DEPTH {
                    nodes.push(Node {
                        path,
                        size,
                        is_dir: true,
                    });
                }
            } else if kind.is_file() {
                let Ok(meta) = entry.metadata() else {
                    continue;
                };
                let size = meta.len();
                let (used, _) = last_used(&meta);
                total += size;
                newest = newest.max(used);
                self.files_seen += 1;
                if self.files_seen.is_multiple_of(5_000) {
                    (self.on_progress)(self.files_seen);
                }
                if !claimed {
                    self.match_extension(&path, size, used);
                    if size >= LARGE_FILE {
                        self.large_files.push(FileHit {
                            path: path.clone(),
                            size,
                            last_used: used,
                        });
                    }
                }
                if depth < MAX_DEPTH {
                    nodes.push(Node {
                        path,
                        size,
                        is_dir: false,
                    });
                }
            }
        }
        if let Some(rule) = matched {
            self.folder_matches.push(FolderMatch {
                rule,
                path: dir.to_path_buf(),
                size: total,
                last_used: newest,
            });
        }
        if depth <= MAX_DEPTH && !nodes.is_empty() {
            self.children.insert(dir.to_path_buf(), nodes);
        }
        (total, newest)
    }

    fn match_extension(&mut self, path: &Path, size: u64, used: u64) {
        if size < MIN_EXTENSION_FILE {
            return;
        }
        let Some(ext) = path.extension().map(|e| e.to_string_lossy().to_lowercase()) else {
            return;
        };
        for (index, (rule, under)) in self.extensions.iter().enumerate() {
            if path.starts_with(under) && rule.extensions.contains(&ext) {
                self.extension_matches.push(ExtensionMatch {
                    rule: index,
                    path: path.to_path_buf(),
                    size,
                    last_used: used,
                });
            }
        }
    }
}

pub fn drill(
    children: &HashMap<PathBuf, Vec<Node>>,
    root: &Path,
    threshold: u64,
    limit: usize,
) -> Vec<Node> {
    let mut hotspots = Vec::new();
    let mut pending = vec![(root.to_path_buf(), 0usize)];
    while let Some((dir, depth)) = pending.pop() {
        let mut big: Vec<&Node> = children
            .get(&dir)
            .map(|nodes| nodes.iter().filter(|n| n.size >= threshold).collect())
            .unwrap_or_default();
        big.sort_by_key(|n| std::cmp::Reverse(n.size));
        if big.is_empty() || depth >= MAX_DEPTH {
            if dir != root
                && let Some(node) = find_node(children, &dir)
            {
                hotspots.push(node);
            }
            continue;
        }
        for node in big.into_iter().rev() {
            if node.is_dir {
                pending.push((node.path.clone(), depth + 1));
            } else {
                hotspots.push(node.clone());
            }
        }
    }
    hotspots.sort_by(|a, b| b.size.cmp(&a.size).then_with(|| a.path.cmp(&b.path)));
    hotspots.truncate(limit);
    hotspots
}

fn find_node(children: &HashMap<PathBuf, Vec<Node>>, path: &Path) -> Option<Node> {
    children
        .get(path.parent()?)?
        .iter()
        .find(|n| n.path == path)
        .cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tree() -> (PathBuf, HashMap<PathBuf, Vec<Node>>) {
        let root = PathBuf::from("r");
        let node = |p: &str, size, is_dir| Node {
            path: PathBuf::from(p),
            size,
            is_dir,
        };
        let mut map = HashMap::new();
        map.insert(
            root.clone(),
            vec![
                node("r/a", 900, true),
                node("r/b", 50, true),
                node("r/big.iso", 300, false),
            ],
        );
        map.insert(
            PathBuf::from("r/a"),
            vec![node("r/a/x", 600, true), node("r/a/y", 300, true)],
        );
        map.insert(PathBuf::from("r/a/x"), vec![node("r/a/x/f", 600, false)]);
        (root, map)
    }

    #[test]
    fn drills_into_largest_branches() {
        let (root, map) = tree();
        let hotspots = drill(&map, &root, 250, 10);
        let paths: Vec<_> = hotspots
            .iter()
            .map(|n| n.path.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(paths, vec!["r/a/x/f", "r/a/y", "r/big.iso"]);
    }

    #[test]
    fn walk_measures_and_matches_folders() {
        let base = std::env::temp_dir().join(format!("betaclean-walk-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let cache = base.join("p").join("__pycache__");
        fs::create_dir_all(cache.join("__pycache__")).unwrap();
        fs::write(cache.join("m.pyc"), vec![0u8; 100]).unwrap();
        fs::write(cache.join("__pycache__").join("n.pyc"), vec![0u8; 20]).unwrap();
        fs::write(base.join("p").join("main.py"), vec![0u8; 10]).unwrap();
        let rules = super::super::rules::load().unwrap();
        let stop = AtomicBool::new(false);
        let noop = |_: usize| {};
        let mut walk = Walk::new(&rules.folders, &[], &stop, &noop);
        let total = walk.run(&base);
        fs::remove_dir_all(&base).unwrap();
        assert_eq!(total, 130);
        assert_eq!(walk.folder_matches.len(), 1);
        assert_eq!(walk.folder_matches[0].size, 120);
    }
}
