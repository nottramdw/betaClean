import { fileName, formatCount } from "../../shared/format";
import { isCleanable, type Safety } from "../../shared/safety";
import type { DuplicateGroup, FileItem } from "../scan/api";
import type { UnusedFile } from "../unused/api";
import type { Finding } from "./api";

const MB = 1024 * 1024;

export const FULL_SCAN = {
  largeMinSize: 500 * MB,
  unusedMinSize: 50 * MB,
  unusedDays: 180,
  duplicateMinSize: MB,
};

export type StepId = "analyzer" | "large" | "unused" | "duplicates" | "virus";

export const STEP_LABEL: Record<StepId, string> = {
  analyzer: "Phân tích dung lượng và tệp rác",
  large: "Tệp lớn",
  unused: "Tệp lâu không dùng",
  duplicates: "Tệp trùng lặp",
  virus: "Quét virus",
};

const SAFETY_ORDER: Record<Safety, number> = {
  "can-xem-xet": 0,
  "an-toan": 1,
  "chi-thong-bao": 2,
  "khong-dong-vao": 3,
};

const FOLDER_CATEGORIES = new Set(["vi-tri-rac", "lap-trinh", "tep-he-thong"]);

function normalize(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

class Coverage {
  private targets = new Set<string>();
  private folders: string[] = [];

  add(finding: Finding) {
    this.targets.add(normalize(finding.path));
    for (const target of finding.targets) this.targets.add(normalize(target));
    if (FOLDER_CATEGORIES.has(finding.category)) {
      this.folders.push(`${normalize(finding.path).replace(/\/$/, "")}/`);
    }
  }

  has(path: string): boolean {
    const key = normalize(path);
    return this.targets.has(key) || this.folders.some((folder) => key.startsWith(folder));
  }
}

function newestPath(files: FileItem[]): string {
  return files.reduce((best, f) => (f.modified > best.modified ? f : best), files[0]).path;
}

function duplicateFinding(group: DuplicateGroup, files: FileItem[]): Finding {
  const keep = newestPath(files);
  const targets = files.map((f) => f.path).filter((p) => p !== keep);
  return {
    id: `trung-lap:${group.hash}`,
    title: `${fileName(keep)} · ${group.files.length} bản`,
    path: keep,
    size: group.reclaimable,
    safety: "can-xem-xet",
    category: "trung-lap",
    reason: `${formatCount(group.files.length)} tệp giống hệt nhau.`,
    action: "Giữ bản mới nhất, chuyển các bản còn lại vào Thùng rác.",
    idleDays: null,
    targets,
    score: 0,
  };
}

function unusedFinding(file: UnusedFile): Finding {
  return {
    id: `lau-khong-dung:${file.path}`,
    title: fileName(file.path),
    path: file.path,
    size: file.size,
    safety: "can-xem-xet",
    category: "lau-khong-dung",
    reason: `Không được dùng trong ${formatCount(file.idleDays)} ngày.`,
    action: "Xem lại; chuyển Thùng rác hoặc sao lưu ra ổ ngoài.",
    idleDays: file.idleDays,
    targets: [file.path],
    score: 0,
  };
}

function largeFinding(file: FileItem): Finding {
  return {
    id: `tep-lon:${file.path}`,
    title: fileName(file.path),
    path: file.path,
    size: file.size,
    safety: "can-xem-xet",
    category: "tep-lon",
    reason: "Tệp chiếm nhiều dung lượng.",
    action: "Xem lại nếu không còn cần.",
    idleDays: null,
    targets: [file.path],
    score: 0,
  };
}

export function mergeFindings(input: {
  analyzer: Finding[];
  unused: UnusedFile[];
  large: FileItem[];
  duplicates: DuplicateGroup[];
}): Finding[] {
  const coverage = new Coverage();
  const ids = new Set<string>();
  const merged: Finding[] = [];
  const push = (finding: Finding) => {
    if (ids.has(finding.id)) return;
    ids.add(finding.id);
    coverage.add(finding);
    merged.push(finding);
  };

  input.analyzer.forEach(push);
  for (const group of input.duplicates) {
    const free = group.files.filter((f) => !coverage.has(f.path));
    if (free.length < 2) continue;
    const finding = duplicateFinding(group, free);
    push({ ...finding, size: group.size * finding.targets.length });
  }
  input.unused.filter((f) => !coverage.has(f.path)).forEach((f) => push(unusedFinding(f)));
  input.large.filter((f) => !coverage.has(f.path)).forEach((f) => push(largeFinding(f)));

  return merged.sort((a, b) => SAFETY_ORDER[a.safety] - SAFETY_ORDER[b.safety] || b.size - a.size);
}

export function reclaimable(findings: Finding[], safety: Safety): number {
  return findings.filter((f) => f.safety === safety).reduce((sum, f) => sum + f.size, 0);
}

export function isSelectable(finding: Finding): boolean {
  return isCleanable(finding.safety) && finding.targets.length > 0;
}
