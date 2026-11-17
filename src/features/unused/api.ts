import { invoke } from "@tauri-apps/api/core";
import { trackScan } from "../../shared/scan-history";

export type UnusedFile = {
  path: string;
  size: number;
  lastUsed: number;
  idleDays: number;
  basis: "accessed" | "modified";
};

export function scanUnusedFiles(options: {
  paths: string[];
  excluded?: string[];
  days: number;
  minSize?: number;
}): Promise<UnusedFile[]> {
  return trackScan("unused", options.paths, () => invoke("scan_unused_files", { options }));
}
