import { Clock, Play, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { moveToTrash } from "../cleanup/api";
import { succeededSet } from "../cleanup/summary";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { cancelScan } from "../scan/api";
import { fileName, formatBytes, formatCount, formatDay, parentDir } from "../../shared/format";
import { useHomeDir } from "../../shared/hooks/use-home-dir";
import { useSelection } from "../../shared/hooks/use-selection";
import { useTask } from "../../shared/hooks/use-task";
import { ActionBar } from "../../shared/ui/action-bar";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel } from "../../shared/ui/page";
import { ScanProgressPanel } from "../../shared/ui/scan-progress-panel";
import { Segmented } from "../../shared/ui/segmented";
import { SelectAll } from "../../shared/ui/select-all";
import { Checkbox, PathCell, Table, Td, Th } from "../../shared/ui/table";
import { scanUnusedFiles, type UnusedFile } from "./api";

const DAY_OPTIONS = [
  { value: 90, label: "90 ngày" },
  { value: 180, label: "180 ngày" },
  { value: 365, label: "1 năm" },
];

export function UnusedPage() {
  const home = useHomeDir();
  const [days, setDays] = useState(180);
  const scan = useTask<UnusedFile[]>();
  const selection = useSelection();
  const cleanup = useCleanupAction();

  const files = scan.data ?? [];
  const chosen = files.filter((f) => selection.selected.has(f.path));
  const chosenSize = chosen.reduce((sum, f) => sum + f.size, 0);
  const total = files.reduce((sum, f) => sum + f.size, 0);

  const start = () => {
    if (!home) return;
    selection.clear();
    void scan.run(() => scanUnusedFiles({ paths: [home], days }));
  };

  const trash = () => {
    const paths = chosen.map((f) => f.path);
    cleanup.request({
      title: "Chuyển vào Thùng rác",
      message: `Chuyển ${paths.length} tệp lâu không dùng (${formatBytes(chosenSize)}) vào Thùng rác.`,
      confirmLabel: "Chuyển vào Thùng rác",
      verb: "Đã chuyển vào Thùng rác",
      execute: () => moveToTrash(paths),
      onDone: (report) => {
        const done = succeededSet(report);
        scan.setData((current) => current?.filter((f) => !done.has(f.path)) ?? current);
        selection.clear();
      },
    });
  };

  return (
    <div className={chosen.length > 0 ? "pb-20" : ""}>
      <PageHeader
        title="Lâu không dùng"
        description="Tệp từ 1 MB không được mở trong khoảng thời gian đã chọn. Hãy kiểm tra kỹ trước khi dọn."
        actions={
          <>
            <Segmented
              options={DAY_OPTIONS}
              value={days}
              onChange={setDays}
              disabled={scan.running}
            />
            {scan.running ? (
              <Button icon={<Square size={14} />} onClick={() => void cancelScan()}>
                Dừng
              </Button>
            ) : (
              <Button variant="primary" icon={<Play size={14} />} onClick={start} disabled={!home}>
                Quét
              </Button>
            )}
          </>
        }
      />

      {cleanup.notice}
      {scan.error && <Notice notice={{ kind: "error", text: scan.error }} />}
      <ScanProgressPanel tool="unused" running={scan.running} root={home} />

      <Panel
        title={scan.data ? `Kết quả (${formatCount(files.length)} tệp)` : undefined}
        aside={scan.data ? `Tổng ${formatBytes(total)}` : undefined}
      >
        {!scan.data ? (
          <EmptyState
            icon={<Clock size={22} />}
            title="Chưa quét tệp lâu không dùng"
            hint="Ưu tiên thời điểm truy cập; nếu hệ thống không ghi nhận, dùng thời điểm sửa đổi."
          />
        ) : files.length === 0 ? (
          <EmptyState icon={<Clock size={22} />} title="Không có tệp nào lâu không dùng" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-12">
                  <SelectAll
                    ids={files.map((f) => f.path)}
                    selected={selection.selected}
                    onChange={selection.setMany}
                  />
                </Th>
                <Th>Tệp</Th>
                <Th className="w-40">Dùng lần cuối</Th>
                <Th className="w-28 text-right">Dung lượng</Th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.path} className="hover:bg-slate-50">
                  <Td>
                    <Checkbox
                      label={file.path}
                      checked={selection.selected.has(file.path)}
                      onChange={() => selection.toggle(file.path)}
                    />
                  </Td>
                  <Td>
                    <PathCell title={fileName(file.path)} path={parentDir(file.path)} />
                  </Td>
                  <Td>
                    <p className="text-slate-700">{formatDay(file.lastUsed)}</p>
                    <p className="text-xs text-slate-500">
                      {formatCount(file.idleDays)} ngày ·{" "}
                      {file.basis === "accessed" ? "truy cập" : "sửa đổi"}
                    </p>
                  </Td>
                  <Td className="text-right font-medium tabular-nums text-slate-700">
                    {formatBytes(file.size)}
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
              Đã chọn {chosen.length} tệp · {formatBytes(chosenSize)}
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
