import type { ReactNode } from "react";
import { Button } from "./button";

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-900">{request.title}</h2>
        <div className="mt-2 text-sm text-slate-600">{request.message}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Huỷ
          </Button>
          <Button
            variant={request.danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Đang xử lý…" : request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
