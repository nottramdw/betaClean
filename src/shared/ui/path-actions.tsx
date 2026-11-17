import { Check, Copy, FolderOpen, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { copyText, revealPath } from "../file-actions";

type Flash = "ok" | "error" | null;

const FLASH_MS = 1600;

function useFlash(): [Flash, (task: () => Promise<void>) => void] {
  const [state, setState] = useState<Flash>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = (task: () => Promise<void>) => {
    const show = (next: Flash) => {
      window.clearTimeout(timer.current);
      setState(next);
      timer.current = window.setTimeout(() => setState(null), FLASH_MS);
    };
    task().then(
      () => show("ok"),
      () => show("error"),
    );
  };

  return [state, run];
}

const LINK =
  "group flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-sm text-left transition-colors";

export function RevealName({
  path,
  children,
  className = "",
}: {
  path: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, run] = useFlash();
  return (
    <button
      type="button"
      onClick={() => run(() => revealPath(path))}
      title="Mở thư mục chứa tệp"
      className={`${LINK} font-medium text-slate-900 hover:text-primary ${className}`}
    >
      <span className="truncate group-hover:underline">{children}</span>
      {state === "error" ? (
        <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-danger">
          <TriangleAlert size={12} aria-hidden />
          Không mở được thư mục
        </span>
      ) : (
        <FolderOpen
          size={14}
          aria-hidden
          className="shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      )}
    </button>
  );
}

export function CopyPath({
  path,
  children,
  className = "",
}: {
  path: string;
  children?: ReactNode;
  className?: string;
}) {
  const [state, run] = useFlash();
  return (
    <button
      type="button"
      onClick={() => run(() => copyText(path))}
      title={`${path}\nNhấn để sao chép đường dẫn`}
      className={`${LINK} font-mono text-xs text-slate-500 hover:text-slate-800 ${className}`}
    >
      <span className="truncate">{children ?? path}</span>
      {state === "ok" ? (
        <span className="flex shrink-0 items-center gap-1 font-sans text-safe">
          <Check size={12} aria-hidden />
          Đã sao chép
        </span>
      ) : state === "error" ? (
        <span className="flex shrink-0 items-center gap-1 font-sans text-danger">
          <TriangleAlert size={12} aria-hidden />
          Không sao chép được
        </span>
      ) : (
        <Copy
          size={12}
          aria-hidden
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      )}
      <span className="sr-only" aria-live="polite">
        {state === "ok" ? "Đã sao chép đường dẫn" : ""}
      </span>
    </button>
  );
}
