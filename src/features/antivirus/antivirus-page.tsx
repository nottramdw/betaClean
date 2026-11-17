import { Play, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";
import { quarantineFiles } from "../cleanup/api";
import { succeededSet } from "../cleanup/summary";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { formatDuration, joinPath } from "../../shared/format";
import { useElapsed } from "../../shared/hooks/use-elapsed";
import { useSelection } from "../../shared/hooks/use-selection";
import { useTask } from "../../shared/hooks/use-task";
import { ActionBar } from "../../shared/ui/action-bar";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel } from "../../shared/ui/page";
import { ProgressPanel } from "../../shared/ui/progress-panel";
import { antivirusStatus, ENGINE_LABEL, type AntivirusStatus, type VirusScanResult } from "./api";
import { hasEngine, mergeThreats, scanWithFreshDatabase, type MergedThreat } from "./engine";
import { ThreatTable } from "./threat-table";
import { driveName, useScanScope } from "../scan/scope";

type Target = { id: string; label: string; path: string };

function scanTargets(home: string, drives: string[]): Target[] {
  return [
    { id: "downloads", label: "Tải về", path: joinPath(home, "Downloads") },
    { id: "desktop", label: "Màn hình nền", path: joinPath(home, "Desktop") },
    { id: "home", label: "Toàn bộ thư mục người dùng", path: home },
    ...drives.map((drive) => ({ id: drive, label: `Ổ ${driveName(drive)}`, path: drive })),
  ];
}

export function AntivirusPage() {
  const scope = useScanScope();
  const status = useTask<AntivirusStatus>();
  const scan = useTask<VirusScanResult>();
  const selection = useSelection();
  const cleanup = useCleanupAction();
  const [targetId, setTargetId] = useState("downloads");
  const [threats, setThreats] = useState<MergedThreat[]>([]);
  const elapsed = useElapsed(scan.running);
  const { run: loadStatus } = status;

  useEffect(() => {
    void loadStatus(antivirusStatus);
  }, [loadStatus]);

  const ready = status.data ? hasEngine(status.data) : false;
  const targets = scope ? scanTargets(scope.home, scope.drives) : [];
  const chosen = threats.filter((t) => selection.selected.has(t.path));

  const start = async () => {
    const target = targets.find((t) => t.id === targetId);
    if (!target) return;
    const path = target.path;
    selection.clear();
    setThreats([]);
    const result = await scan.run(() => scanWithFreshDatabase([path]));
    if (result) {
      const merged = mergeThreats(result);
      setThreats(merged);
      selection.replace(merged.map((t) => t.path));
    }
  };

  const quarantine = () => {
    const items = chosen.map((t) => ({ path: t.path, reason: t.names.join(", ") }));
    cleanup.request({
      title: "Cách ly tệp nhiễm",
      message: `Di chuyển ${items.length} tệp vào Khu cách ly. Tệp không thể chạy được nhưng vẫn khôi phục được khi cần.`,
      confirmLabel: "Cách ly",
      danger: true,
      verb: "Đã cách ly",
      execute: () => quarantineFiles(items),
      onDone: (report) => {
        const done = succeededSet(report);
        setThreats((current) => current.filter((t) => !done.has(t.path)));
        selection.clear();
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Quét virus"
        description="Quét offline trên máy. Cơ sở dữ liệu virus tự cập nhật khi có kết nối mạng."
        actions={
          <Button
            variant="primary"
            icon={<Play size={14} />}
            onClick={() => void start()}
            disabled={!scope || !ready || scan.running}
          >
            Quét
          </Button>
        }
      />

      {cleanup.notice}
      {status.error && <Notice notice={{ kind: "error", text: status.error }} />}
      {scan.error && <Notice notice={{ kind: "error", text: scan.error }} />}
      {status.data && !ready && (
        <Notice notice={{ kind: "warning", text: "Chưa có công cụ quét khả dụng trên máy này." }} />
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-slate-500">Phạm vi quét:</span>
        {targets.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={scan.running}
            onClick={() => setTargetId(item.id)}
            className={`h-8 rounded-full border px-3 text-sm font-medium transition-colors ${
              targetId === item.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {scan.running && (
        <ProgressPanel
          label="Đang quét virus, quá trình có thể mất vài phút"
          detail={`Đã chạy ${formatDuration(elapsed)}`}
          percent={null}
        />
      )}

      {scan.data?.errors.map((error) => (
        <Notice key={error} notice={{ kind: "warning", text: error }} />
      ))}

      <Panel
        title={scan.data ? `Kết quả (${threats.length} mối đe doạ)` : undefined}
        aside={
          scan.data
            ? `Công cụ: ${scan.data.enginesUsed.map((e) => ENGINE_LABEL[e]).join(", ") || "—"}`
            : undefined
        }
      >
        {!scan.data ? (
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="Chưa quét"
            hint="Chọn phạm vi rồi bấm Quét. Tệp nhiễm được đưa vào Khu cách ly, không xoá ngay."
          />
        ) : threats.length === 0 ? (
          <EmptyState
            icon={
              scan.data.enginesUsed.length > 0 ? <ShieldCheck size={22} /> : <ShieldOff size={22} />
            }
            title={
              scan.data.enginesUsed.length > 0
                ? "Không phát hiện mối đe doạ"
                : "Không có công cụ nào chạy được"
            }
          />
        ) : (
          <ThreatTable
            threats={threats}
            selected={selection.selected}
            onToggle={selection.toggle}
            onSetMany={selection.setMany}
          />
        )}
      </Panel>

      {chosen.length > 0 && (
        <ActionBar
          summary={
            <span className="font-semibold text-danger">Đã chọn {chosen.length} tệp nhiễm</span>
          }
        >
          <Button variant="ghost" onClick={selection.clear}>
            Bỏ chọn
          </Button>
          <Button variant="danger" icon={<ShieldAlert size={14} />} onClick={quarantine}>
            Cách ly
          </Button>
        </ActionBar>
      )}
      {cleanup.dialog}
    </div>
  );
}
