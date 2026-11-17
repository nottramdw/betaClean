import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { progressPercent } from "../progress-text";
import { expectedFiles, noteCollected } from "../scan-history";

export type ScanProgress = {
  tool: string;
  stage: string;
  checked: number;
  total: number;
  bytesChecked: number;
  bytesTotal: number;
};

export type TrackedProgress = ScanProgress & {
  percent: number | null;
  expected: number | null;
  remaining: number | null;
};

type Anchor = { stage: string; at: number; percent: number };

const MIN_SECONDS = 3;
const MIN_PERCENT = 1;
const MAX_GUESS = 99;

function estimate(anchor: Anchor, percent: number, now: number): number | null {
  const seconds = (now - anchor.at) / 1000;
  const gained = percent - anchor.percent;
  if (seconds < MIN_SECONDS || gained < MIN_PERCENT || percent >= 100) return null;
  return (seconds / gained) * (100 - percent);
}

function track(payload: ScanProgress): Pick<TrackedProgress, "percent" | "expected"> {
  const percent = progressPercent(payload);
  if (percent !== null) return { percent, expected: null };
  noteCollected(payload.tool, payload.checked);
  const expected = expectedFiles(payload.tool);
  if (expected === null || payload.checked >= expected) return { percent: null, expected: null };
  return { percent: Math.min((payload.checked / expected) * 100, MAX_GUESS), expected };
}

export function useScanProgress(tool: string, active: boolean): TrackedProgress | null {
  const [progress, setProgress] = useState<TrackedProgress | null>(null);
  const anchor = useRef<Anchor | null>(null);

  useEffect(() => {
    if (!active) return;
    const unlisten = listen<ScanProgress>("scan-progress", (event) => {
      if (event.payload.tool !== tool) return;
      const now = Date.now();
      const { percent, expected } = track(event.payload);
      if (percent === null) {
        anchor.current = null;
        setProgress({ ...event.payload, percent, expected, remaining: null });
        return;
      }
      if (
        !anchor.current ||
        anchor.current.stage !== event.payload.stage ||
        percent < anchor.current.percent
      ) {
        anchor.current = { stage: event.payload.stage, at: now, percent };
      }
      setProgress({
        ...event.payload,
        percent,
        expected,
        remaining: estimate(anchor.current, percent, now),
      });
    });
    return () => {
      void unlisten.then((stop) => stop());
      anchor.current = null;
      setProgress(null);
    };
  }, [tool, active]);

  return active ? progress : null;
}
