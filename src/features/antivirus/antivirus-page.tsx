import { Database, Play, RefreshCw, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";
import { quarantineFiles } from "../cleanup/api";
import { succeededSet } from "../cleanup/summary";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { errorText, fileName, formatDate, joinPath, parentDir } from "../../shared/format";
import { useElapsed } from "../../shared/hooks/use-elapsed";
import { useHomeDir } from "../../shared/hooks/use-home-dir";
import { useSelection } from "../../shared/hooks/use-selection";
import { useTask } from "../../shared/hooks/use-task";
import { ActionBar } from "../../shared/ui/action-bar";
import { Badge, ThreatBadge } from "../../shared/ui/badge";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel, type NoticeData } from "../../shared/ui/page";
import { ProgressPanel } from "../../shared/ui/progress-panel";
import { SelectAll } from "../../shared/ui/select-all";
import { Checkbox, PathCell, Table, Td, Th } from "../../shared/ui/table";
import {
  antivirusStatus,
  ENGINE_LABEL,
  scanViruses,
  updateVirusDatabase,
  type AntivirusStatus,
  type Engine,
  type VirusScanResult,
} from "./api";

type Scope = "home" | "downloads" | "desktop";

const SCOPES: { id: Scope; label: string; folder: string | null }[] = [
  { id: "downloads", label: "Tải về", folder: "Downloads" },
  { id: "desktop", label: "Màn hình nền", folder: "Desktop" },
  { id: "home", label: "Toàn bộ thư mục người dùng", folder: null },
];

type MergedThreat = { path: string; names: string[]; engines: Engine[] };

function merge(result: VirusScanResult): MergedThreat[] {
  const byPath = new Map<string, MergedThreat>();
  for (const threat of result.threats) {
    const entry = byPath.get(threat.path) ?? { path: threat.path, names: [], engines: [] };
    if (!entry.names.includes(threat.name)) entry.names.push(threat.name);
    if (!entry.engines.includes(threat.engine)) entry.engines.push(threat.engine);
    byPath.set(threat.path, entry);
  }
  return [...byPath.values()];
}

function EngineCard({ name, path }: { name: string; path?: string | null }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800">{name}</span>
        {path ? (
          <Badge className="border-green-200 bg-green-50 text-safe">Sẵn sàng</Badge>
        ) : (
          <Badge className="border-slate-200 bg-slate-50 text-info">Không có</Badge>
        )}
      </div>
      <p
        className="selectable mt-2 truncate font-mono text-xs text-slate-500"
        title={path ?? undefined}
      >
        {path ?? "Chưa cài đặt hoặc không hỗ trợ trên hệ điều hành này"}
      </p>
    </div>
  );
}

export function AntivirusPage() {
  const home = useHomeDir();
  const status = useTask<AntivirusStatus>();
  const scan = useTask<VirusScanResult>();
  const selection = useSelection();
  const cleanup = useCleanupAction();
  const [scope, setScope] = useState<Scope>("downloads");
  const [updating, setUpdating] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<NoticeData | null>(null);
  const [threats, setThreats] = useState<MergedThreat[]>([]);
  const elapsed = useElapsed(scan.running);
  const { run: loadStatus } = status;

  useEffect(() => {
    void loadStatus(antivirusStatus);
  }, [loadStatus]);

  const info = status.data;
  const hasEngine = Boolean(info && ((info.clamscan && info.databaseReady) || info.defender));
  const chosen = threats.filter((t) => selection.selected.has(t.path));

  const update = async () => {
    setUpdating(true);
    setUpdateNotice(null);
    try {
      const output = await updateVirusDatabase();
      setUpdateNotice({
        kind: "success",
        text: "Đã cập nhật cơ sở dữ liệu virus.",
        details: output ? [output] : [],
      });
      void loadStatus(antivirusStatus);
    } catch (e) {
      setUpdateNotice({ kind: "error", text: errorText(e) });
    } finally {
      setUpdating(false);
    }
  };

  const start = async () => {
    if (!home) return;
    const target = SCOPES.find((s) => s.id === scope);
    const path = target?.folder ? joinPath(home, target.folder) : home;
    selection.clear();
    setThreats([]);
    const result = await scan.run(() => scanViruses([path]));
    if (result) {
      const merged = merge(result);
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
    <div className={chosen.length > 0 ? "pb-20" : ""}>
      <PageHeader
        title="Quét virus"
        description="Quét offline bằng ClamAV và Microsoft Defender có sẵn trên máy. Chỉ cần mạng khi cập nhật cơ sở dữ liệu."
        actions={
          <Button
            variant="primary"
            icon={<Play size={14} />}
            onClick={() => void start()}
            disabled={!home || !hasEngine || scan.running}
          >
            Quét
          </Button>
        }
      />

      {updateNotice && <Notice notice={updateNotice} onClose={() => setUpdateNotice(null)} />}
      {cleanup.notice}
      {status.error && <Notice notice={{ kind: "error", text: status.error }} />}
      {scan.error && <Notice notice={{ kind: "error", text: scan.error }} />}
      {info && !hasEngine && (
        <Notice
          notice={{
            kind: "warning",
            text: "Chưa có công cụ quét khả dụng. Cài ClamAV rồi cập nhật cơ sở dữ liệu, hoặc dùng Microsoft Defender trên Windows.",
          }}
        />
      )}

      <div className="mb-6 grid grid-cols-3 gap-4">
        <EngineCard name="ClamAV" path={info?.clamscan} />
        <EngineCard name="Microsoft Defender" path={info?.defender} />
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Database size={16} />
              Cơ sở dữ liệu ClamAV
            </span>
            {info?.databaseReady ? (
              <Badge className="border-green-200 bg-green-50 text-safe">Có sẵn</Badge>
            ) : (
              <Badge className="border-amber-200 bg-amber-50 text-review">Chưa có</Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Cập nhật lần cuối: {info?.databaseUpdated ? formatDate(info.databaseUpdated) : "—"}
          </p>
          <Button
            className="mt-3 h-8 px-3"
            icon={<RefreshCw size={14} className={updating ? "animate-spin" : ""} />}
            onClick={() => void update()}
            disabled={!info?.freshclam || updating}
          >
            {updating ? "Đang cập nhật…" : "Cập nhật"}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-slate-500">Phạm vi quét:</span>
        {SCOPES.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={scan.running}
            onClick={() => setScope(item.id)}
            className={`h-8 rounded-full border px-3 text-sm font-medium transition-colors ${
              scope === item.id
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
          detail={`${elapsed} giây`}
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
          <Table>
            <thead>
              <tr>
                <Th className="w-12">
                  <SelectAll
                    ids={threats.map((t) => t.path)}
                    selected={selection.selected}
                    onChange={selection.setMany}
                  />
                </Th>
                <Th>Tệp</Th>
                <Th className="w-64">Mối đe doạ</Th>
                <Th className="w-40">Công cụ</Th>
              </tr>
            </thead>
            <tbody>
              {threats.map((threat) => (
                <tr key={threat.path} className="hover:bg-slate-50">
                  <Td>
                    <Checkbox
                      label={threat.path}
                      checked={selection.selected.has(threat.path)}
                      onChange={() => selection.toggle(threat.path)}
                    />
                  </Td>
                  <Td>
                    <PathCell title={fileName(threat.path)} path={parentDir(threat.path)} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {threat.names.map((name) => (
                        <ThreatBadge key={name}>{name}</ThreatBadge>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-xs text-slate-600">
                    {threat.engines.map((e) => ENGINE_LABEL[e]).join(", ")}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
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
