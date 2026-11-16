import { HardDrive } from "lucide-react";
import { formatBytes } from "../../shared/format";
import type { Volume } from "./api";

export function VolumeCard({ volume }: { volume: Volume }) {
  const percent = volume.total > 0 ? (volume.used / volume.total) * 100 : 0;
  const tone = percent >= 90 ? "bg-danger" : percent >= 75 ? "bg-review" : "bg-primary";
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <HardDrive size={16} />Ổ {volume.mount}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
        {formatBytes(volume.free)}
        <span className="ml-1 text-sm font-medium text-slate-500">còn trống</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Đã dùng {formatBytes(volume.used)} / {formatBytes(volume.total)} ({Math.round(percent)}%)
      </p>
    </div>
  );
}
