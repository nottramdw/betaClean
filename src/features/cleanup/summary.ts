import { formatBytes } from "../../shared/format";
import type { NoticeData } from "../../shared/ui/page";
import type { CleanupReport } from "./api";

export function summarize(report: CleanupReport, verb: string): NoticeData {
  const done = report.succeeded.length;
  const failed = report.failed.length;
  const base = `${verb} ${done} mục${report.bytes > 0 ? ` (${formatBytes(report.bytes)})` : ""}`;
  if (failed === 0) return { kind: "success", text: `${base}.` };
  return {
    kind: done === 0 ? "error" : "warning",
    text: `${base}; ${failed} mục không xử lý được.`,
    details: report.failed.map((f) => `${f.target}: ${f.error}`),
  };
}

export function succeededSet(report: CleanupReport): Set<string> {
  return new Set(report.succeeded);
}
