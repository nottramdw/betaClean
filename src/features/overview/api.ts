import { invoke } from "@tauri-apps/api/core";
import type { Safety } from "../../shared/safety";

export type Volume = { mount: string; total: number; free: number; used: number };

export type Category = "vi-tri-rac" | "tep-he-thong" | "lap-trinh" | "tai-ve" | "lau-khong-dung";

export type Finding = {
  id: string;
  title: string;
  path: string;
  size: number;
  safety: Safety;
  category: Category;
  reason: string;
  action: string;
  idleDays: number | null;
  targets: string[];
  score: number;
};

export type Hotspot = { path: string; size: number; share: number; isDir: boolean };

export type AnalysisReport = {
  generatedAt: number;
  volumes: Volume[];
  roots: string[];
  scannedBytes: number;
  findings: Finding[];
  hotspots: Hotspot[];
  reclaimableSafe: number;
  reclaimableReview: number;
};

export const CATEGORY_LABEL: Record<Category, string> = {
  "vi-tri-rac": "Vị trí rác",
  "tep-he-thong": "Tệp hệ thống",
  "lap-trinh": "Lập trình",
  "tai-ve": "Tải về",
  "lau-khong-dung": "Lâu không dùng",
};

export function listVolumes(): Promise<Volume[]> {
  return invoke("list_volumes");
}

export function analyzeDisk(): Promise<AnalysisReport> {
  return invoke("analyze_disk", { options: {} });
}
