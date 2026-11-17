import { formatBytes, formatCount, formatDuration } from "./format";
import type { ScanProgress, TrackedProgress } from "./hooks/use-scan-progress";

export function stageLabel(progress: ScanProgress | null): string {
  if (!progress) return "Đang chuẩn bị…";
  const stage = progress.stage.toLowerCase();
  if (stage.includes("prehash")) return "Đang so sánh phần đầu tệp";
  if (stage.includes("hash")) return "Đang so sánh nội dung tệp";
  if (stage.includes("size") || stage.includes("calculat")) return "Đang tính dung lượng";
  if (stage.includes("collect")) return "Đang duyệt tệp";
  return "Đang quét";
}

export function progressPercent(progress: ScanProgress | null): number | null {
  if (!progress) return null;
  if (progress.bytesTotal > 0) return (progress.bytesChecked / progress.bytesTotal) * 100;
  if (progress.total > 0) return (progress.checked / progress.total) * 100;
  return null;
}

function timeText(progress: TrackedProgress | null, elapsed: number): string {
  const spent = `Đã chạy ${formatDuration(elapsed)}`;
  if (progress?.remaining == null) return spent;
  return `${spent} · còn khoảng ${formatDuration(progress.remaining)}`;
}

export function progressDetail(progress: TrackedProgress | null, elapsed: number): string {
  const time = timeText(progress, elapsed);
  if (!progress) return time;
  if (progress.bytesTotal > 0) {
    return `${formatBytes(progress.bytesChecked)} / ${formatBytes(progress.bytesTotal)} · ${time}`;
  }
  if (progress.total > 0) {
    return `${formatCount(progress.checked)} / ${formatCount(progress.total)} tệp · ${time}`;
  }
  return `${formatCount(progress.checked)} tệp · ${time}`;
}
