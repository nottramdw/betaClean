import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

export type ScanProgress = {
  tool: string;
  stage: string;
  checked: number;
  total: number;
  bytesChecked: number;
  bytesTotal: number;
};

export function useScanProgress(tool: string, active: boolean): ScanProgress | null {
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  useEffect(() => {
    if (!active) return;
    const unlisten = listen<ScanProgress>("scan-progress", (event) => {
      if (event.payload.tool === tool) setProgress(event.payload);
    });
    return () => {
      void unlisten.then((stop) => stop());
      setProgress(null);
    };
  }, [tool, active]);

  return active ? progress : null;
}
