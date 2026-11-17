import { Info, Play, Sparkles, Trash2 } from "lucide-react";
import { moveToTrash } from "../cleanup/api";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { formatBytes, formatCount } from "../../shared/format";
import { useSelection } from "../../shared/hooks/use-selection";
import { useTask } from "../../shared/hooks/use-task";
import { isCleanable } from "../../shared/safety";
import { ActionBar } from "../../shared/ui/action-bar";
import { SafetyBadge } from "../../shared/ui/badge";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel, StatCard } from "../../shared/ui/page";
import { ProgressPanel } from "../../shared/ui/progress-panel";
import { SelectAll } from "../../shared/ui/select-all";
import { Checkbox, PathCell, Table, Td, Th } from "../../shared/ui/table";
import { scanJunkLocations, type JunkLocation } from "./api";

function selectable(location: JunkLocation): boolean {
  return isCleanable(location.safety) && location.targets.length > 0 && location.size > 0;
}

export function JunkPage() {
  const scan = useTask<JunkLocation[]>();
  const selection = useSelection();
  const cleanup = useCleanupAction();

  const locations = scan.data ?? [];
  const selectableIds = locations.filter(selectable).map((l) => l.id);
  const chosen = locations.filter((l) => selection.selected.has(l.id));
  const chosenSize = chosen.reduce((sum, l) => sum + l.size, 0);
  const total = locations.reduce((sum, l) => sum + l.size, 0);
  const safeTotal = locations
    .filter((l) => l.safety === "an-toan")
    .reduce((sum, l) => sum + l.size, 0);

  const start = async () => {
    selection.clear();
    const result = await scan.run(scanJunkLocations);
    if (result)
      selection.replace(
        result.filter((l) => l.safety === "an-toan" && selectable(l)).map((l) => l.id),
      );
  };

  const trash = () => {
    const targets = chosen.flatMap((l) => l.targets);
    cleanup.request({
      title: "Dọn tệp rác",
      message: `Chuyển nội dung của ${chosen.length} vị trí (${formatBytes(chosenSize)}) vào Thùng rác. Bản thân các thư mục được giữ nguyên.`,
      confirmLabel: "Dọn ngay",
      verb: "Đã chuyển vào Thùng rác",
      execute: () => moveToTrash(targets),
      onDone: () => void start(),
    });
  };

  return (
    <div>
      <PageHeader
        title="Tệp rác"
        description="Bộ nhớ đệm, tệp tạm và nhật ký ở các vị trí đã biết của hệ điều hành và ứng dụng."
        actions={
          <Button
            variant="primary"
            icon={<Play size={14} />}
            onClick={() => void start()}
            disabled={scan.running}
          >
            {scan.data ? "Quét lại" : "Quét"}
          </Button>
        }
      />

      {cleanup.notice}
      {scan.error && <Notice notice={{ kind: "error", text: scan.error }} />}
      {scan.running && <ProgressPanel label="Đang đo dung lượng các vị trí rác" />}

      {scan.data && (
        <div className="mb-6 grid grid-cols-1 gap-4 @2xl:grid-cols-3">
          <StatCard
            label="Tổng dung lượng phát hiện"
            value={formatBytes(total)}
            hint={`${locations.length} vị trí`}
          />
          <StatCard label="An toàn để dọn" value={formatBytes(safeTotal)} tone="text-safe" />
          <StatCard
            label="Đang chọn"
            value={formatBytes(chosenSize)}
            tone="text-primary"
            hint={`${chosen.length} vị trí`}
          />
        </div>
      )}

      <Panel title={scan.data ? `Vị trí rác (${locations.length})` : undefined}>
        {!scan.data ? (
          <EmptyState
            icon={<Sparkles size={22} />}
            title="Chưa quét tệp rác"
            hint="Bấm Quét để đo dung lượng các vị trí rác. Mục an toàn được chọn sẵn; mục cần xem xét bạn tự quyết định."
          />
        ) : locations.length === 0 ? (
          <EmptyState icon={<Sparkles size={22} />} title="Không tìm thấy tệp rác" />
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
                <Th>Vị trí</Th>
                <Th className="w-28 text-right">Số tệp</Th>
                <Th className="w-36">Mức an toàn</Th>
                <Th className="w-28 text-right">Dung lượng</Th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id} className="hover:bg-slate-50">
                  <Td>
                    {selectable(location) ? (
                      <Checkbox
                        label={location.label}
                        checked={selection.selected.has(location.id)}
                        onChange={() => selection.toggle(location.id)}
                      />
                    ) : (
                      <Info size={16} className="text-info" />
                    )}
                  </Td>
                  <Td>
                    <PathCell title={location.label} path={location.path} />
                  </Td>
                  <Td className="text-right tabular-nums text-slate-600">
                    {formatCount(location.fileCount)}
                  </Td>
                  <Td>
                    <SafetyBadge safety={location.safety} />
                  </Td>
                  <Td className="text-right font-medium tabular-nums text-slate-700">
                    {formatBytes(location.size)}
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
            <span className="font-semibold text-slate-800">
              Đã chọn {chosen.length} vị trí · {formatBytes(chosenSize)}
            </span>
          }
        >
          <Button variant="ghost" onClick={selection.clear}>
            Bỏ chọn
          </Button>
          <Button variant="primary" icon={<Trash2 size={14} />} onClick={trash}>
            Dọn ngay
          </Button>
        </ActionBar>
      )}
      {cleanup.dialog}
    </div>
  );
}
