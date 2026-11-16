import { useElapsed } from "../hooks/use-elapsed";
import { useScanProgress } from "../hooks/use-scan-progress";
import { progressDetail, progressPercent, stageLabel } from "../progress-text";
import { ProgressPanel } from "./progress-panel";

export function ScanProgressPanel({
  tool,
  running,
  root,
}: {
  tool: string;
  running: boolean;
  root?: string | null;
}) {
  const progress = useScanProgress(tool, running);
  const elapsed = useElapsed(running);
  if (!running) return null;
  const label = root ? `${stageLabel(progress)}: ${root}` : stageLabel(progress);
  return (
    <ProgressPanel
      label={label}
      detail={progressDetail(progress, elapsed)}
      percent={progressPercent(progress)}
    />
  );
}
