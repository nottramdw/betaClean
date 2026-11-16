import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {meta}
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-line bg-white shadow-sm ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {aside && <div className="text-xs text-slate-500">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "text-slate-900",
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-white p-5 shadow-sm">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`mt-2 text-2xl font-bold tabular-nums ${tone}`}>{value}</span>
      {hint && <span className="mt-1 text-xs text-slate-500">{hint}</span>}
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {hint && <p className="mt-1 max-w-md text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

type NoticeKind = "success" | "warning" | "error" | "info";

const NOTICE_STYLE: Record<NoticeKind, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

const NOTICE_ICON: Record<NoticeKind, ReactNode> = {
  success: <CheckCircle2 size={16} />,
  warning: <AlertTriangle size={16} />,
  error: <XCircle size={16} />,
  info: <Info size={16} />,
};

export type NoticeData = { kind: NoticeKind; text: string; details?: string[] };

export function Notice({ notice, onClose }: { notice: NoticeData; onClose?: () => void }) {
  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${NOTICE_STYLE[notice.kind]}`}
    >
      <span className="mt-0.5 shrink-0">{NOTICE_ICON[notice.kind]}</span>
      <div className="min-w-0 flex-1">
        <p className="selectable">{notice.text}</p>
        {notice.details && notice.details.length > 0 && (
          <ul className="selectable mt-1 max-h-32 list-disc overflow-y-auto pl-4 text-xs opacity-90">
            {notice.details.map((line) => (
              <li key={line} className="break-all">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs font-medium opacity-70 hover:opacity-100"
        >
          Đóng
        </button>
      )}
    </div>
  );
}
