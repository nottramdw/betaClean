import { Gauge, Play, Square, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { moveToTrash } from "../cleanup/api";
import { succeededSet } from "../cleanup/summary";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { formatBytes, formatDate, shortenPath } from "../../shared/format";
import { useSelection } from "../../shared/hooks/use-selection";
import { useTask } from "../../shared/hooks/use-task";
import { ActionBar } from "../../shared/ui/action-bar";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel, StatCard } from "../../shared/ui/page";
import { CopyPath } from "../../shared/ui/path-actions";
import { ScanProgressPanel } from "../../shared/ui/scan-progress-panel";
import { listVolumes, type Volume } from "./api";
import { FindingsTable } from "./findings-table";
import { isSelectable, reclaimable, STEP_LABEL } from "./full-scan";
import { useFullScan } from "./use-full-scan";
import { VolumeCard } from "./volume-card";

export function OverviewPage() {
  const volumes = useTask<Volume[]>();
  const scan = useFullScan();
  const selection = useSelection();
  const cleanup = useCleanupAction();
  const { run: loadVolumes } = volumes;

  useEffect(() => {
    void loadVolumes(listVolumes);
  }, [loadVolumes]);

  const result = scan.result;
  const findings = result?.findings ?? [];
  const chosen = findings.filter((f) => selection.selected.has(f.id));
  const chosenSize = chosen.reduce((sum, f) => sum + f.size, 0);
  const shownVolumes = result?.report.volumes ?? volumes.data ?? [];
  const step = scan.step;

  const start = async () => {
    selection.clear();
    cleanup.setNotice(null);
    const next = await scan.start();
    if (next) {
      selection.replace(
        next.findings.filter((f) => f.safety === "an-toan" && isSelectable(f)).map((f) => f.id),
      );
    }
    void loadVolumes(listVolumes);
  };

  const trash = () => {
    const targets = chosen.flatMap((f) => f.targets);
    cleanup.request({
      title: "Chuyển vào Thùng rác",
      message: `Chuyển ${chosen.length} mục (${formatBytes(chosenSize)}) vào Thùng rác. Có thể khôi phục từ Thùng rác của hệ điều hành.`,
      confirmLabel: "Chuyển vào Thùng rác",
      verb: "Đã chuyển vào Thùng rác",
      execute: () => moveToTrash(targets),
      onDone: (report) => {
        const done = succeededSet(report);
        scan.setResult((current) =>
          current
            ? {
                ...current,
                findings: current.findings.filter((f) => !f.targets.every((t) => done.has(t))),
              }
            : current,
        );
        selection.clear();
        void loadVolumes(listVolumes);
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description="Quét thư mục người dùng và các ổ dữ liệu khác: tệp rác, tệp lâu không dùng, tệp lớn, tệp trùng lặp. Mục cần xem xét hiển thị trước."
        actions={
          scan.running ? (
            <Button icon={<Square size={14} />} onClick={scan.stop}>
              Dừng
            </Button>
          ) : (
            <Button variant="primary" icon={<Play size={14} />} onClick={() => void start()}>
              {result ? "Quét lại" : "Quét toàn bộ"}
            </Button>
          )
        }
      />

      {cleanup.notice}
      {scan.errors.length > 0 && (
        <Notice
          notice={{
            kind: "warning",
            text: "Một số bước không hoàn tất.",
            details: scan.errors,
          }}
        />
      )}
      {volumes.error && <Notice notice={{ kind: "error", text: volumes.error }} />}

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">
        {shownVolumes.map((volume) => (
          <VolumeCard key={volume.mount} volume={volume} />
        ))}
        <StatCard
          label="Cần xem xét"
          value={result ? formatBytes(reclaimable(findings, "can-xem-xet")) : "—"}
          tone="text-review"
          hint="Tải về, tệp lớn, trùng lặp, lâu không dùng"
        />
        <StatCard
          label="Có thể dọn an toàn"
          value={result ? formatBytes(reclaimable(findings, "an-toan")) : "—"}
          tone="text-safe"
          hint="Bộ nhớ đệm, tệp tạm tự sinh lại"
        />
      </div>

      {step && (
        <ScanProgressPanel
          tool={step.id}
          running
          root={step.root}
          after={step.after}
          prefix={`Bước ${step.index}/${step.total}: ${STEP_LABEL[step.id]}`}
        />
      )}

      {!result && !scan.running && (
        <Panel>
          <EmptyState
            icon={<Gauge size={22} />}
            title="Chưa quét"
            hint="Bấm Quét toàn bộ để chạy lần lượt mọi công cụ trên thư mục người dùng và các ổ dữ liệu khác. Quá trình có thể mất vài phút đến vài chục phút. Không có tệp nào bị xoá khi chưa xác nhận."
          />
        </Panel>
      )}

      {result && (
        <div className="grid grid-cols-12 gap-6">
          <Panel
            className="col-span-12 @5xl:col-span-8 @[100rem]:col-span-9"
            title={`Đề xuất dọn dẹp (${findings.length})`}
            aside={formatDate(result.report.generatedAt)}
          >
            {findings.length === 0 ? (
              <EmptyState icon={<Gauge size={22} />} title="Không có đề xuất nào" />
            ) : (
              <FindingsTable
                findings={findings}
                selected={selection.selected}
                onToggle={selection.toggle}
                onSetMany={(ids, on) => selection.setMany(ids, on)}
              />
            )}
          </Panel>

          <Panel
            className="col-span-12 @5xl:col-span-4 @[100rem]:col-span-3"
            title="Vùng chiếm nhiều dung lượng"
          >
            <ul className="divide-y divide-slate-100">
              {result.report.hotspots.map((spot) => (
                <li key={spot.path} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <CopyPath path={spot.path} className="text-slate-700">
                      {shortenPath(spot.path, 42)}
                    </CopyPath>
                    <span className="shrink-0 font-medium tabular-nums text-slate-800">
                      {formatBytes(spot.size)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${spot.share * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {chosen.length > 0 && (
        <ActionBar
          summary={
            <span className="font-semibold text-slate-800">
              Đã chọn {chosen.length} mục · {formatBytes(chosenSize)}
            </span>
          }
        >
          <Button variant="ghost" onClick={selection.clear}>
            Bỏ chọn
          </Button>
          <Button variant="primary" icon={<Trash2 size={14} />} onClick={trash}>
            Chuyển vào Thùng rác
          </Button>
        </ActionBar>
      )}
      {cleanup.dialog}
    </div>
  );
}
