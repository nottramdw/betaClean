import type { ReactNode } from "react";
import { SAFETY_LABEL, SAFETY_STYLE, type Safety } from "../safety";

export function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function SafetyBadge({ safety }: { safety: Safety }) {
  return <Badge className={SAFETY_STYLE[safety]}>{SAFETY_LABEL[safety]}</Badge>;
}

export function ThreatBadge({ children }: { children: ReactNode }) {
  return <Badge className="border-red-200 bg-red-50 text-danger">{children}</Badge>;
}
