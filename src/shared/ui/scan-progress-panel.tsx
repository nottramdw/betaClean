import { useElapsed } from "../hooks/use-elapsed";
import { useScanProgress } from "../hooks/use-scan-progress";
import { countText, stageLabel, timeText } from "../progress-text";
import { ProgressPanel } from "./progress-panel";

export function ScanProgressPanel({
  tool,
  running,
  root,
  prefix,
  after,
}: {
  tool: string;
  running: boolean;
  root?: string | null;
  prefix?: string;
  after?: number | null;
}) {
  const progress = useScanProgress(tool, running);
  const elapsed = useElapsed(running);
  if (!running) return null;
  const stage = root ? `${stageLabel(progress)}: ${root}` : stageLabel(progress);
  const label = prefix ? `${prefix} · ${stage}` : stage;
  const count = countText(progress);
  const time = timeText(progress?.remaining, elapsed, after);
  return (
    <ProgressPanel
      label={label}
      detail={count ? `${count} · ${time}` : time}
      percent={progress?.percent ?? null}
    />
  );
}
