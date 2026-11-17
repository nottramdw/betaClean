import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { Overlay } from "./overlay";

export type ConfirmRequest = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
};

export function ConfirmDialog({
  request,
  busy,
  onConfirm,
  onCancel,
}: {
  request: ConfirmRequest;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (request.danger ? cancelRef : confirmRef).current?.focus();
  }, [request]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <Overlay>
      <div
        className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) onCancel();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex max-h-[calc(100dvh-3rem)] w-full max-w-md animate-dialog-in flex-col rounded-2xl bg-white p-6 shadow-dialog"
        >
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900">
            {request.title}
          </h2>
          <div className="mt-2 min-h-0 overflow-y-auto text-sm leading-relaxed text-pretty text-slate-600">
            {request.message}
          </div>
          <div className="mt-6 flex shrink-0 justify-end gap-2">
            <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={busy}>
              Huỷ
            </Button>
            <Button
              ref={confirmRef}
              variant={request.danger ? "danger" : "primary"}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? "Đang xử lý…" : request.confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
