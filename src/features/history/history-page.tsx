import { History, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { getCleanupHistory, type CleanupAction, type HistoryEntry } from "../cleanup/api";
import { fileName, formatBytes, formatDate, parentDir } from "../../shared/format";
import { useTask } from "../../shared/hooks/use-task";
import { Badge } from "../../shared/ui/badge";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel } from "../../shared/ui/page";
import { PathCell, Table, Td, Th } from "../../shared/ui/table";

const ACTION_LABEL: Record<CleanupAction, string> = {
  trash: "Thùng rác",
  quarantine: "Cách ly",
  restore: "Khôi phục",
  delete: "Xoá vĩnh viễn",
};

const ACTION_STYLE: Record<CleanupAction, string> = {
  trash: "border-teal-200 bg-primary-soft text-primary",
  quarantine: "border-red-200 bg-red-50 text-danger",
  restore: "border-slate-200 bg-slate-50 text-info",
  delete: "border-red-200 bg-red-50 text-danger",
};

export function HistoryPage({ active }: { active: boolean }) {
  const history = useTask<HistoryEntry[]>();
  const { run: load } = history;

  useEffect(() => {
    if (active) void load(() => getCleanupHistory(500));
  }, [active, load]);

  const entries = history.data ?? [];

  return (
    <div>
      <PageHeader
        title="Lịch sử"
        description="Nhật ký mọi thao tác dọn dẹp, cách ly, khôi phục và xoá."
        actions={
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => void load(() => getCleanupHistory(500))}
            disabled={history.running}
          >
            Làm mới
          </Button>
        }
      />

      {history.error && <Notice notice={{ kind: "error", text: history.error }} />}

      <Panel title={`Thao tác gần đây (${entries.length})`}>
        {entries.length === 0 ? (
          <EmptyState icon={<History size={22} />} title="Chưa có thao tác nào" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-40">Thời điểm</Th>
                <Th className="w-36">Thao tác</Th>
                <Th>Đường dẫn</Th>
                <Th className="w-24 text-right">Dung lượng</Th>
                <Th className="w-28">Kết quả</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={`${entry.time}-${entry.path}-${index}`} className="hover:bg-slate-50">
                  <Td className="text-slate-600">{formatDate(entry.time)}</Td>
                  <Td>
                    <Badge className={ACTION_STYLE[entry.action]}>
                      {ACTION_LABEL[entry.action]}
                    </Badge>
                  </Td>
                  <Td>
                    <PathCell title={fileName(entry.path)} path={parentDir(entry.path)} />
                    {entry.error && (
                      <p className="selectable mt-0.5 truncate text-xs text-danger">
                        {entry.error}
                      </p>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums text-slate-700">
                    {formatBytes(entry.size)}
                  </Td>
                  <Td>
                    {entry.success ? (
                      <Badge className="border-green-200 bg-green-50 text-safe">Thành công</Badge>
                    ) : (
                      <Badge className="border-red-200 bg-red-50 text-danger">Thất bại</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
