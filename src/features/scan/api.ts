import { invoke } from "@tauri-apps/api/core";

export type ScanOptions = {
  paths: string[];
  excluded?: string[];
  minSize?: number;
  limit?: number;
};

export type FileItem = { path: string; size: number; modified: number };

export type DuplicateGroup = {
  size: number;
  hash: string;
  reclaimable: number;
  files: FileItem[];
};

export function scanLargeFiles(options: ScanOptions): Promise<FileItem[]> {
  return invoke("scan_large_files", { options });
}

export function scanDuplicates(options: ScanOptions): Promise<DuplicateGroup[]> {
  return invoke("scan_duplicates", { options });
}

export function cancelScan(): Promise<void> {
  return invoke("cancel_scan");
}
