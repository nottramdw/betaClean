import { Gauge, HardDrive, Info, Play, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { cancelScan } from "../scan/api";
import { moveToTrash } from "../cleanup/api";
import { succeededSet } from "../cleanup/summary";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { formatBytes, formatDate, shortenPath } from "../../shared/format";
import { useSelection } from "../../shared/hooks/use-selection";
import { useTask } from "../../shared/hooks/use-task";
import { isCleanable } from "../../shared/safety";
import { ActionBar } from "../../shared/ui/action-bar";
import { SafetyBadge } from "../../shared/ui/badge";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel, StatCard } from "../../shared/ui/page";
import { ScanProgressPanel } from "../../shared/ui/scan-progress-panel";
import { SelectAll } from "../../shared/ui/select-all";
import { Checkbox, Table, Td, Th } from "../../shared/ui/table";
import {
  analyzeDisk,
  CATEGORY_LABEL,
  listVolumes,
  type AnalysisReport,
  type Finding,
  type Volume,
} from "./api";

function VolumeCard({ volume }: { volume: Volume }) {
  const percent = volume.total > 0 ? (volume.used / volume.total) * 100 : 0;
  const tone = percent >= 90 ? "bg-danger" : percent >= 75 ? "bg-review" : "bg-primary";
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <HardDrive size={16} />Ổ {volume.mount}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
        {formatBytes(volume.free)}
        <span className="ml-1 text-sm font-medium text-slate-500">còn trống</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Đã dùng {formatBytes(volume.used)} / {formatBytes(volume.total)} ({Math.round(percent)}%)
      </p>
    </div>
  );
}

function selectable(finding: Finding): boolean {
  return isCleanable(finding.safety) && finding.targets.length > 0;
}

export function OverviewPage() {
  const volumes = useTask<Volume[]>();
  const analysis = useTask<AnalysisReport>();
  const selection = useSelection();
  const cleanup = useCleanupAction();
  const { run: loadVolumes } = volumes;

  useEffect(() => {
    void loadVolumes(listVolumes);
  }, [loadVolumes]);

  const report = analysis.data;
  const findings = useMemo(() => report?.findings ?? [], [report]);
  const selectableIds = findings.filter(selectable).map((f) => f.id);
  const chosen = findings.filter((f) => selection.selected.has(f.id));
  const chosenSize = chosen.reduce((sum, f) => sum + f.size, 0);
  const shownVolumes = report?.volumes ?? volumes.data ?? [];

  const start = async () => {
    selection.clear();
    cleanup.setNotice(null);
    const result = await analysis.run(analyzeDisk);
    if (result) {
      selection.replace(
        result.findings
          .filter((f) => f.safety === "an-toan" && f.targets.length > 0)
          .map((f) => f.id),
      );
    }
  };

  const trash = () => {
    const targets = chosen.flatMap((f) => f.targets);
    cleanup.request({
      title: "Chuyển vào Thùng rác",
      message: `Chuyển ${chosen.length} mục (${formatBytes(chosenSize)}) vào Thùng rác. Có thể khôi phục từ Thùng rác của hệ điều hành.`,
      confirmLabel: "Chuyển vào Thùng rác",
      verb: "Đã chuyển vào Thùng rác",
      execute: () => moveToTrash(targets),
      onDone: (result) => {
        const done = succeededSet(result);
        analysis.setData((current) =>
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
    <div className={chosen.length > 0 ? "pb-20" : ""}>
      <PageHeader
        title="Tổng quan"
        description="Phân tích dung lượng offline theo bộ quy tắc của betaClean, đề xuất mục nên dọn."
        actions={
          analysis.running ? (
            <Button icon={<Square size={14} />} onClick={() => void cancelScan()}>
              Dừng
            </Button>
          ) : (
            <Button variant="primary" icon={<Play size={14} />} onClick={() => void start()}>
              {report ? "Phân tích lại" : "Phân tích"}
            </Button>
          )
        }
      />

      {cleanup.notice}
      {analysis.error && <Notice notice={{ kind: "error", text: analysis.error }} />}
      {volumes.error && <Notice notice={{ kind: "error", text: volumes.error }} />}

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {shownVolumes.slice(0, 2).map((volume) => (
          <VolumeCard key={volume.mount} volume={volume} />
        ))}
        <StatCard
          label="Có thể dọn an toàn"
          value={report ? formatBytes(report.reclaimableSafe) : "—"}
          tone="text-safe"
          hint="Bộ nhớ đệm, tệp tạm tự sinh lại"
        />
        <StatCard
          label="Cần xem xét"
          value={report ? formatBytes(report.reclaimableReview) : "—"}
          tone="text-review"
          hint="Tải về, bộ cài cũ, tệp lớn lâu không dùng"
        />
      </div>

      <ScanProgressPanel
        tool="analyzer"
        running={analysis.running}
        root={report?.roots[0] ?? "thư mục người dùng"}
      />

      {!report && !analysis.running && (
        <Panel>
          <EmptyState
            icon={<Gauge size={22} />}
            title="Chưa có kết quả phân tích"
            hint="Bấm Phân tích để duyệt thư mục người dùng, đối chiếu vị trí rác đã biết và xếp hạng mục nên dọn. Không có tệp nào bị xoá khi chưa xác nhận."
          />
        </Panel>
      )}

      {report && (
        <div className="grid grid-cols-12 gap-6">
          <Panel
            className="col-span-12 xl:col-span-8"
            title={`Đề xuất dọn dẹp (${findings.length})`}
            aside={`Đã phân tích ${formatBytes(report.scannedBytes)} · ${formatDate(report.generatedAt)}`}
          >
            {findings.length === 0 ? (
              <EmptyState icon={<Gauge size={22} />} title="Không có đề xuất nào" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-12">
                      <SelectAll
                        ids={selectableIds}
                        selected={selection.selected}
                        onChange={selection.setMany}
                      />
                    </Th>
                    <Th>Mục</Th>
                    <Th className="w-36">Mức an toàn</Th>
                    <Th className="w-28 text-right">Dung lượng</Th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((finding) => (
                    <tr key={finding.id} className="hover:bg-slate-50">
                      <Td>
                        {selectable(finding) ? (
                          <Checkbox
                            label={finding.title}
                            checked={selection.selected.has(finding.id)}
                            onChange={() => selection.toggle(finding.id)}
                          />
                        ) : (
                          <Info size={16} className="text-info" />
                        )}
                      </Td>
                      <Td>
                        <p className="truncate font-medium text-slate-900">
                          {finding.title}
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {CATEGORY_LABEL[finding.category]}
                          </span>
                        </p>
                        <p
                          className="selectable truncate font-mono text-xs text-slate-500"
                          title={finding.path}
                        >
                          {finding.path}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {finding.reason}{" "}
                          <span
                            className={
                              finding.safety === "chi-thong-bao" ? "font-medium text-info" : ""
                            }
                          >
                            {finding.action}
                          </span>
                        </p>
                      </Td>
                      <Td>
                        <SafetyBadge safety={finding.safety} />
                      </Td>
                      <Td className="text-right font-medium tabular-nums text-slate-700">
                        {formatBytes(finding.size)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>

          <Panel className="col-span-12 xl:col-span-4" title="Vùng chiếm nhiều dung lượng">
            <ul className="divide-y divide-slate-100">
              {report.hotspots.map((spot) => (
                <li key={spot.path} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span
                      className="selectable truncate font-mono text-xs text-slate-700"
                      title={spot.path}
                    >
                      {shortenPath(spot.path, 42)}
                    </span>
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
