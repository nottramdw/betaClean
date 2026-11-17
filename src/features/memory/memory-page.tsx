import { Lock, MemoryStick, Power, RefreshCw, Search, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { formatBytes, formatCount } from "../../shared/format";
import { useTask } from "../../shared/hooks/use-task";
import { Badge } from "../../shared/ui/badge";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel, StatCard } from "../../shared/ui/page";
import { PathCell, Table, Td, Th } from "../../shared/ui/table";
import { memoryUsage, stopProcesses, type AppUsage, type MemoryReport } from "./api";

const REFRESH_MS = 3000;
const LIMIT = 100;

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function loadTone(ratio: number): string {
  if (ratio >= 90) return "bg-danger";
  if (ratio >= 75) return "bg-amber-500";
  return "bg-primary";
}

export function MemoryPage({ active }: { active: boolean }) {
  const usage = useTask<MemoryReport>();
  const cleanup = useCleanupAction();
  const [query, setQuery] = useState("");
  const { run: load } = usage;
  const paused = cleanup.busy || cleanup.dialog !== null;

  useEffect(() => {
    if (!active || paused) return;
    void load(memoryUsage);
    const timer = window.setInterval(() => void load(memoryUsage), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [active, paused, load]);

  const report = usage.data;
  const apps = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = report?.apps ?? [];
    const matched = term
      ? list.filter(
          (a) => a.name.toLowerCase().includes(term) || a.path?.toLowerCase().includes(term),
        )
      : list;
    return matched.slice(0, LIMIT);
  }, [report, query]);

  const ratio = report ? percent(report.used, report.total) : 0;

  const stop = (app: AppUsage, force: boolean) => {
    cleanup.request({
      title: force ? `Buộc dừng ${app.name}` : `Đóng ${app.name}`,
      message: force
        ? `Kết thúc ngay ${formatCount(app.pids.length)} tiến trình. Dữ liệu chưa lưu sẽ bị mất.`
        : `Yêu cầu ${app.name} tự đóng (${formatCount(app.pids.length)} tiến trình). Ứng dụng có thể hỏi lưu dữ liệu trước khi thoát.`,
      confirmLabel: force ? "Buộc dừng" : "Đóng",
      danger: force,
      verb: force ? "Đã buộc dừng" : "Đã đóng",
      execute: () => stopProcesses(app.id, app.pids, force),
      onDone: () => void load(memoryUsage),
    });
  };

  return (
    <div>
      <PageHeader
        title="Bộ nhớ RAM"
        description="Ứng dụng và tiến trình đang chiếm RAM, cập nhật mỗi 3 giây. Tiến trình hệ thống được bảo vệ."
        actions={
          <Button icon={<RefreshCw size={14} />} onClick={() => void load(memoryUsage)}>
            Làm mới
          </Button>
        }
      />

      {cleanup.notice}
      {usage.error && <Notice notice={{ kind: "error", text: usage.error }} />}

      <div className="mb-6 grid grid-cols-2 gap-4 @4xl:grid-cols-4">
        <StatCard
          label="Đang dùng"
          value={report ? `${ratio}%` : "—"}
          hint={report ? `${formatBytes(report.used)} / ${formatBytes(report.total)}` : undefined}
        >
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full ${loadTone(ratio)}`} style={{ width: `${ratio}%` }} />
          </div>
        </StatCard>
        <StatCard label="Còn trống" value={report ? formatBytes(report.available) : "—"} />
        <StatCard
          label="Bộ nhớ ảo (swap)"
          value={report ? formatBytes(report.swapUsed) : "—"}
          hint={
            report && report.swapTotal > 0 ? `trên ${formatBytes(report.swapTotal)}` : undefined
          }
        />
        <StatCard
          label="Ứng dụng, tiến trình"
          value={report ? formatCount(report.apps.length) : "—"}
        />
      </div>

      <Panel
        title="Theo mức chiếm RAM"
        aside={
          <label className="flex h-8 items-center gap-2 rounded-lg border border-line px-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm ứng dụng"
              className="w-44 bg-transparent text-sm text-slate-700 outline-none focus-visible:outline-none @4xl:w-60"
            />
          </label>
        }
      >
        {apps.length === 0 ? (
          <EmptyState
            icon={<MemoryStick size={22} />}
            title={report ? "Không có kết quả" : "Đang đọc bộ nhớ"}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ứng dụng</Th>
                <Th className="w-24 text-right">Tiến trình</Th>
                <Th className="w-20 text-right">CPU</Th>
                <Th className="w-28 text-right">RAM</Th>
                <Th className="w-64 text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <Td>
                    <PathCell title={app.name} path={app.path ?? "Không xác định được vị trí"} />
                  </Td>
                  <Td className="text-right tabular-nums text-slate-600">
                    {formatCount(app.pids.length)}
                  </Td>
                  <Td className="text-right tabular-nums text-slate-600">{app.cpu.toFixed(1)}%</Td>
                  <Td className="text-right font-medium tabular-nums text-slate-800">
                    {formatBytes(app.memory)}
                  </Td>
                  <Td className="text-right">
                    {app.protected ? (
                      <span title={app.protected}>
                        <Badge className="border-slate-200 bg-slate-50 text-slate-500">
                          <Lock size={11} />
                          Được bảo vệ
                        </Badge>
                      </span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button
                          className="h-8 px-3"
                          icon={<Power size={13} />}
                          onClick={() => stop(app, false)}
                        >
                          Đóng
                        </Button>
                        <Button
                          variant="danger-outline"
                          className="h-8 px-3"
                          icon={<Zap size={13} />}
                          onClick={() => stop(app, true)}
                        >
                          Buộc dừng
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {cleanup.dialog}
    </div>
  );
}
