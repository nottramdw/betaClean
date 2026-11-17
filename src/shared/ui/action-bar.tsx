import type { ReactNode } from "react";

export function ActionBar({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-(--sidebar-w) right-0 z-20 animate-fade-in border-t border-line bg-white/95 backdrop-blur transition-[left] duration-200 ease-out">
      <div className="mx-auto flex h-16 max-w-(--content-max) items-center justify-between gap-4 px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          <span className="truncate">{summary}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
