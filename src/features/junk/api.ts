import { invoke } from "@tauri-apps/api/core";
import type { Safety } from "../../shared/safety";

export type JunkLocation = {
  id: string;
  label: string;
  path: string;
  safety: Safety;
  size: number;
  fileCount: number;
  targets: string[];
};

export function scanJunkLocations(): Promise<JunkLocation[]> {
  return invoke("scan_junk_locations");
}

export function measureJunkLocations(ids: string[]): Promise<JunkLocation[]> {
  return invoke("measure_junk_locations", { ids });
}
