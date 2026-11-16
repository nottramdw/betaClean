import { FileBox, Play, Square, Trash2 } from "lucide-react";
import { moveToTrash } from "../cleanup/api";
import { succeededSet } from "../cleanup/summary";
import { useCleanupAction } from "../cleanup/use-cleanup-action";
import { fileName, formatBytes, formatDay, parentDir } from "../../shared/format";
import { useHomeDir } from "../../shared/hooks/use-home-dir";
import { useSelection } from "../../shared/hooks/use-selection";
import { useTask } from "../../shared/hooks/use-task";
import { ActionBar } from "../../shared/ui/action-bar";
import { Button } from "../../shared/ui/button";
import { EmptyState, Notice, PageHeader, Panel } from "../../shared/ui/page";
import { ScanProgressPanel } from "../../shared/ui/scan-progress-panel";
import { SelectAll } from "../../shared/ui/select-all";
import { Segmented } from "../../shared/ui/segmented";
import { Checkbox, PathCell, Table, Td, Th } from "../../shared/ui/table";
import { useState } from "react";
import { cancelScan, scanLargeFiles, type FileItem } from "./api";

const MB = 1024 * 1024;
const SIZE_OPTIONS = [
  { value: 50 * MB, label: "≥ 50 MB" },
  { value: 100 * MB, label: "≥ 100 MB" },
  { value: 500 * MB, label: "≥ 500 MB" },
  { value: 1024 * MB, label: "≥ 1 GB" },
];

export function LargeFilesPage() {
  const home = useHomeDir();
  const [minSize, setMinSize] = useState(100 * MB);
  const scan = useTask<FileItem[]>();
  const selection = useSelection();
  const cleanup = useCleanupAction();

  const files = scan.data ?? [];
  const chosen = files.filter((f) => selection.selected.has(f.path));
  const chosenSize = chosen.reduce((sum, f) => sum + f.size, 0);

  const start = () => {
    if (!home) return;
    selection.clear();
    void scan.run(() => scanLargeFiles({ paths: [home], minSize }));
  };

  const trash = () => {
    const paths = chosen.map((f) => f.path);
    cleanup.request({
      title: "Chuyển vào Thùng rác",
      message: `Chuyển ${paths.length} tệp (${formatBytes(chosenSize)}) vào Thùng rác.`,
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
        title="Tệp lớn"
        description="Tìm các tệp chiếm nhiều dung lượng trong thư mục người dùng."
        actions={
          <>
            <Segmented
              options={SIZE_OPTIONS}
              value={minSize}
              onChange={setMinSize}
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
      <ScanProgressPanel tool="large" running={scan.running} root={home} />

      <Panel title={scan.data ? `Kết quả (${files.length} tệp)` : undefined}>
        {!scan.data ? (
          <EmptyState
            icon={<FileBox size={22} />}
            title="Chưa quét tệp lớn"
            hint="Chọn ngưỡng dung lượng rồi bấm Quét. Kết quả sắp xếp theo dung lượng giảm dần."
          />
        ) : files.length === 0 ? (
          <EmptyState icon={<FileBox size={22} />} title="Không có tệp nào vượt ngưỡng" />
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
                <Th className="w-32">Sửa đổi</Th>
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
                  <Td className="text-slate-600">{formatDay(file.modified)}</Td>
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
