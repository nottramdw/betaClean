import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export function ProgressPanel({
  label,
  detail,
  percent,
}: {
  label: ReactNode;
  detail?: ReactNode;
  percent?: number | null;
}) {
  const known = percent !== undefined && percent !== null && Number.isFinite(percent);
  const value = known ? Math.max(0, Math.min(100, percent)) : 0;
  return (
    <div className="mb-6 rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <div className="flex min-w-0 flex-[1_1_20rem] items-start gap-2 text-slate-700">
          <LoaderCircle size={16} className="mt-0.5 shrink-0 animate-spin text-primary" />
          <span className="min-w-0 break-words">{label}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-slate-500">
          {detail}
          {known && (
            <span className="rounded bg-primary-soft px-2 py-0.5 font-semibold text-primary">
              {Math.round(value)}%
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        {known ? (
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${value}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/70" />
        )}
      </div>
    </div>
  );
}
