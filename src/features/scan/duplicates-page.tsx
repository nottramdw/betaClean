import { Copy, Play, Square, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { moveToTrash } from "../cleanup/api";
import { succeededSet } from "../cleanup/summary";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { fileName, formatBytes, formatDay, parentDir } from "../../shared/format";
import { useSelection } from "../../shared/hooks/use-selection";
import { useTask } from "../../shared/hooks/use-task";
import { ActionBar } from "../../shared/ui/action-bar";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel, StatCard } from "../../shared/ui/page";
import { ScanProgressPanel } from "../../shared/ui/scan-progress-panel";
import { Checkbox, PathCell } from "../../shared/ui/table";
import { cancelScan, scanDuplicates, type DuplicateGroup } from "./api";
import { loadScanScope, scopeLabel, type ScanScope } from "./scope";

function newest(group: DuplicateGroup): string {
  return group.files.reduce(
    (best, file) => (file.modified > best.modified ? file : best),
    group.files[0],
  ).path;
}

export function DuplicatesPage() {
  const [scope, setScope] = useState<ScanScope | null>(null);
  const scan = useTask<DuplicateGroup[]>();
  const selection = useSelection();
  const cleanup = useCleanupAction();

  const groups = scan.data ?? [];
  const sizeOf = new Map(groups.flatMap((g) => g.files.map((f) => [f.path, f.size] as const)));
  const chosen = [...selection.selected].filter((p) => sizeOf.has(p));
  const chosenSize = chosen.reduce((sum, p) => sum + (sizeOf.get(p) ?? 0), 0);
  const fullGroups = groups.filter((g) =>
    g.files.every((f) => selection.selected.has(f.path)),
  ).length;
  const reclaimable = groups.reduce((sum, g) => sum + g.reclaimable, 0);

  const start = () => {
    selection.clear();
    void scan.run(async () => {
      const next = await loadScanScope();
      setScope(next);
      return scanDuplicates({ paths: next.paths, excluded: next.excluded, minSize: 1024 * 1024 });
    });
  };

  const autoSelect = () => {
    selection.replace(
      groups.flatMap((g) => g.files.map((f) => f.path).filter((p) => p !== newest(g))),
    );
  };

  const trash = () => {
    cleanup.request({
      title: "Chuyển bản sao vào Thùng rác",
      message: `Chuyển ${chosen.length} tệp (${formatBytes(chosenSize)}) vào Thùng rác. Mỗi nhóm vẫn giữ ít nhất một bản.`,
      confirmLabel: "Chuyển vào Thùng rác",
      verb: "Đã chuyển vào Thùng rác",
      execute: () => moveToTrash(chosen),
      onDone: (report) => {
        const done = succeededSet(report);
        scan.setData(
          (current) =>
            current
              ?.map((g) => {
                const files = g.files.filter((f) => !done.has(f.path));
                return { ...g, files, reclaimable: g.size * Math.max(0, files.length - 1) };
              })
              .filter((g) => g.files.length > 1) ?? current,
        );
        selection.clear();
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Tệp trùng lặp"
        description="So sánh nội dung tệp (≥ 1 MB) trong thư mục người dùng và các ổ dữ liệu khác để tìm các bản sao giống hệt nhau."
        actions={
          <>
            {groups.length > 0 && !scan.running && (
              <Button icon={<Wand2 size={14} />} onClick={autoSelect}>
                Chọn tự động
              </Button>
            )}
            {scan.running ? (
              <Button icon={<Square size={14} />} onClick={() => void cancelScan()}>
                Dừng
              </Button>
            ) : (
              <Button variant="primary" icon={<Play size={14} />} onClick={start}>
                Quét
              </Button>
            )}
          </>
        }
      />

      {cleanup.notice}
      {scan.error && <Notice notice={{ kind: "error", text: scan.error }} />}
      {fullGroups > 0 && (
        <Notice
          notice={{
            kind: "warning",
            text: `${fullGroups} nhóm đang chọn toàn bộ bản sao. Bỏ chọn ít nhất một tệp mỗi nhóm để giữ lại.`,
          }}
        />
      )}
      <ScanProgressPanel tool="duplicates" running={scan.running} root={scopeLabel(scope)} />

      {scan.data && (
        <div className="mb-6 grid grid-cols-1 gap-4 @2xl:grid-cols-3">
          <StatCard label="Nhóm trùng lặp" value={groups.length} />
          <StatCard label="Có thể thu hồi" value={formatBytes(reclaimable)} tone="text-review" />
          <StatCard
            label="Đang chọn"
            value={formatBytes(chosenSize)}
            tone="text-primary"
            hint={`${chosen.length} tệp`}
          />
        </div>
      )}

      {!scan.data ? (
        <Panel>
          <EmptyState
            icon={<Copy size={22} />}
            title="Chưa quét tệp trùng lặp"
            hint="Bấm Quét để tìm bản sao. Chọn tự động giữ lại bản mới nhất của mỗi nhóm."
          />
        </Panel>
      ) : groups.length === 0 ? (
        <Panel>
          <EmptyState icon={<Copy size={22} />} title="Không tìm thấy tệp trùng lặp" />
        </Panel>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Panel
              key={group.hash}
              title={`${fileName(group.files[0].path)} · ${group.files.length} bản`}
              aside={`${formatBytes(group.size)} mỗi bản · thu hồi ${formatBytes(group.reclaimable)}`}
            >
              <ul className="divide-y divide-slate-100">
                {group.files.map((file) => (
                  <li
                    key={file.path}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50"
                  >
                    <Checkbox
                      label={file.path}
                      checked={selection.selected.has(file.path)}
                      onChange={() => selection.toggle(file.path)}
                    />
                    <div className="min-w-0 flex-1">
                      <PathCell
                        title={fileName(file.path)}
                        path={parentDir(file.path)}
                        target={file.path}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">
                      {formatDay(file.modified)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      {chosen.length > 0 && (
        <ActionBar
          summary={
            <span className="font-semibold text-slate-800">
              Đã chọn {chosen.length} tệp · {formatBytes(chosenSize)}
            </span>
          }
        >
          <Button variant="ghost" onClick={selection.clear}>
            Bỏ chọn
          </Button>
          <Button
            variant="primary"
            icon={<Trash2 size={14} />}
            onClick={trash}
            disabled={fullGroups > 0}
          >
            Chuyển vào Thùng rác
          </Button>
        </ActionBar>
      )}
      {cleanup.dialog}
    </div>
  );
}
