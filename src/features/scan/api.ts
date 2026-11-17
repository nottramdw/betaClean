import { invoke } from "@tauri-apps/api/core";
import { trackScan } from "../../shared/scan-history";

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
  return trackScan("large", options.paths, () => invoke("scan_large_files", { options }));
}

export function scanDuplicates(options: ScanOptions): Promise<DuplicateGroup[]> {
  return trackScan("duplicates", options.paths, () => invoke("scan_duplicates", { options }));
}

export function cancelScan(): Promise<void> {
  return invoke("cancel_scan");
}
