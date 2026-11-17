import type { ReactNode } from "react";
import { CopyPath, RevealName } from "./path-actions";

export function Table({ children }: { children: ReactNode }) {
  return <table className="w-full table-fixed border-collapse text-sm">{children}</table>;
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`sticky top-0 z-10 border-b border-line bg-slate-50 px-4 py-2.5 text-left text-xs font-medium text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <td className={`border-b border-slate-100 px-4 py-3 align-middle ${className}`}>{children}</td>
  );
}

export function PathCell({
  title,
  path,
  target = path,
}: {
  title: string;
  path: string;
  target?: string | null;
}) {
  if (!target) {
    return (
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900" title={title}>
          {title}
        </p>
        <p className="truncate text-xs text-slate-500">{path}</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <RevealName path={target}>{title}</RevealName>
      <CopyPath path={target}>{path}</CopyPath>
    </div>
  );
}

export function Checkbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate && !checked;
      }}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
