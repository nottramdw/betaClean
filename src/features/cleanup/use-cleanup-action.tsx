import { useState } from "react";
import { errorText } from "../../shared/format";
import { ConfirmDialog, type ConfirmRequest } from "../../shared/ui/confirm-dialog";
import { Notice, type NoticeData } from "../../shared/ui/page";
import type { CleanupReport } from "./api";
import { summarize } from "./summary";

type Pending = ConfirmRequest & {
  verb: string;
  execute: () => Promise<CleanupReport>;
  onDone?: (report: CleanupReport) => void;
};

export function useCleanupAction() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeData | null>(null);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const report = await pending.execute();
      setNotice(summarize(report, pending.verb));
      pending.onDone?.(report);
    } catch (e) {
      setNotice({ kind: "error", text: errorText(e) });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const dialog = pending ? (
    <ConfirmDialog
      request={pending}
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={() => setPending(null)}
    />
  ) : null;

  const noticeView = notice ? <Notice notice={notice} onClose={() => setNotice(null)} /> : null;

  return { request: setPending, dialog, notice: noticeView, setNotice, busy };
}
