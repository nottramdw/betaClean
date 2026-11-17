import { Archive, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useEffect } from "react";
import {
  deleteQuarantined,
  listQuarantine,
  restoreQuarantined,
  type QuarantineEntry,
} from "../cleanup/api";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { fileName, formatBytes, formatDate, parentDir } from "../../shared/format";
import { useSelection } from "../../shared/hooks/use-selection";
import { useTask } from "../../shared/hooks/use-task";
import { ActionBar } from "../../shared/ui/action-bar";
import { ThreatBadge } from "../../shared/ui/badge";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel, StatCard } from "../../shared/ui/page";
import { SelectAll } from "../../shared/ui/select-all";
import { Checkbox, PathCell, Table, Td, Th } from "../../shared/ui/table";

export function QuarantinePage({ active }: { active: boolean }) {
  const list = useTask<QuarantineEntry[]>();
  const selection = useSelection();
  const cleanup = useCleanupAction();
  const { run: load } = list;

  useEffect(() => {
    if (active) void load(listQuarantine);
  }, [active, load]);

  const entries = list.data ?? [];
  const chosen = entries.filter((e) => selection.selected.has(e.id));
  const chosenIds = chosen.map((e) => e.id);
  const total = entries.reduce((sum, e) => sum + e.size, 0);

  const refresh = () => {
    selection.clear();
    void load(listQuarantine);
  };

  const restore = () => {
    cleanup.request({
      title: "Khôi phục tệp",
      message: `Đưa ${chosen.length} tệp về vị trí ban đầu. Chỉ khôi phục khi chắc chắn tệp an toàn.`,
      confirmLabel: "Khôi phục",
      verb: "Đã khôi phục",
      execute: () => restoreQuarantined(chosenIds),
      onDone: refresh,
    });
  };

  const remove = () => {
    cleanup.request({
      title: "Xoá vĩnh viễn",
      message: `Xoá vĩnh viễn ${chosen.length} tệp. Thao tác này không thể hoàn tác.`,
      confirmLabel: "Xoá vĩnh viễn",
      danger: true,
      verb: "Đã xoá vĩnh viễn",
      execute: () => deleteQuarantined(chosenIds),
      onDone: refresh,
    });
  };

  return (
    <div>
      <PageHeader
        title="Khu cách ly"
        description="Tệp nghi nhiễm được cô lập tại đây. Có thể khôi phục về vị trí cũ hoặc xoá vĩnh viễn."
        actions={
          <Button icon={<RefreshCw size={14} />} onClick={refresh} disabled={list.running}>
            Làm mới
          </Button>
        }
      />

      {cleanup.notice}
      {list.error && <Notice notice={{ kind: "error", text: list.error }} />}

      <div className="mb-6 grid grid-cols-1 gap-4 @xl:grid-cols-2">
        <StatCard label="Tệp đang cách ly" value={entries.length} />
        <StatCard label="Tổng dung lượng" value={formatBytes(total)} />
      </div>

      <Panel title={`Danh sách (${entries.length})`}>
        {entries.length === 0 ? (
          <EmptyState icon={<Archive size={22} />} title="Khu cách ly trống" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-12">
                  <SelectAll
                    ids={entries.map((e) => e.id)}
                    selected={selection.selected}
                    onChange={selection.setMany}
                  />
                </Th>
                <Th>Vị trí gốc</Th>
                <Th className="w-56">Lý do</Th>
                <Th className="w-40">Thời điểm</Th>
                <Th className="w-24 text-right">Dung lượng</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <Td>
                    <Checkbox
                      label={entry.originalPath}
                      checked={selection.selected.has(entry.id)}
                      onChange={() => selection.toggle(entry.id)}
                    />
                  </Td>
                  <Td>
                    <PathCell
                      title={fileName(entry.originalPath)}
                      path={parentDir(entry.originalPath)}
                      target={entry.originalPath}
                    />
                  </Td>
                  <Td>
                    <ThreatBadge>
                      <span className="truncate" title={entry.reason}>
                        {entry.reason}
                      </span>
                    </ThreatBadge>
                  </Td>
                  <Td className="text-slate-600">{formatDate(entry.quarantinedAt)}</Td>
                  <Td className="text-right font-medium tabular-nums text-slate-700">
                    {formatBytes(entry.size)}
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
            <span className="font-semibold text-slate-800">Đã chọn {chosen.length} tệp</span>
          }
        >
          <Button variant="ghost" onClick={selection.clear}>
            Bỏ chọn
          </Button>
          <Button icon={<RotateCcw size={14} />} onClick={restore}>
            Khôi phục
          </Button>
          <Button variant="danger-outline" icon={<Trash2 size={14} />} onClick={remove}>
            Xoá vĩnh viễn
          </Button>
        </ActionBar>
      )}
      {cleanup.dialog}
    </div>
  );
}
