import { invoke } from "@tauri-apps/api/core";

export type UnusedFile = {
  path: string;
  size: number;
  lastUsed: number;
  idleDays: number;
  basis: "accessed" | "modified";
};

export function scanUnusedFiles(options: {
  paths: string[];
  days: number;
  minSize?: number;
}): Promise<UnusedFile[]> {
  return invoke("scan_unused_files", { options });
}
