import type { ReactNode } from "react";

export function ActionBar({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-[232px] right-0 z-20 flex h-16 items-center justify-between border-t border-line bg-white/95 px-8 backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <span className="h-2 w-2 rounded-full bg-primary" />
        {summary}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
