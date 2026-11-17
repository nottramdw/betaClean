import { useCallback, useRef, useState } from "react";
import { errorText } from "../../shared/format";
import { recallSeconds } from "../../shared/scan-history";
import { cancelScan, scanDuplicates, scanLargeFiles } from "../scan/api";
import { loadScanScope, scopeLabel } from "../scan/scope";
import { scanUnusedFiles } from "../unused/api";
import { analyzeDisk, type AnalysisReport, type Finding } from "./api";
import { FULL_SCAN, mergeFindings, STEP_LABEL, type StepId } from "./full-scan";

export type FullScanResult = {
  report: AnalysisReport;
  findings: Finding[];
};

export type StepState = {
  id: StepId;
  index: number;
  total: number;
  after: number | null;
  root: string | null;
};

export function useFullScan() {
  const [result, setResult] = useState<FullScanResult | null>(null);
  const [step, setStep] = useState<StepState | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const cancelled = useRef(false);

  const start = useCallback(async (): Promise<FullScanResult | null> => {
    cancelled.current = false;
    setErrors([]);
    const issues: string[] = [];
    const steps: StepId[] = ["analyzer", "unused", "large", "duplicates"];

    let paths: string[] = [];
    let root: string | null = null;
    const enter = (id: StepId) => {
      const index = steps.indexOf(id);
      const later = steps.slice(index + 1).map((next) => recallSeconds(next, paths));
      const known = later.filter((s): s is number => s !== null);
      const after = known.length === later.length ? known.reduce((a, b) => a + b, 0) : null;
      setStep({ id, index: index + 1, total: steps.length, after, root });
    };

    const runStep = async <T>(id: StepId, task: () => Promise<T>, fallback: T): Promise<T> => {
      if (cancelled.current) return fallback;
      enter(id);
      try {
        return await task();
      } catch (e) {
        issues.push(`${STEP_LABEL[id]}: ${errorText(e)}`);
        return fallback;
      }
    };

    try {
      setStep({ id: "analyzer", index: 1, total: steps.length, after: null, root: null });
      const scope = await loadScanScope();
      paths = scope.paths;
      root = scopeLabel(scope);
      const excluded = scope.excluded;
      enter("analyzer");
      const report = await analyzeDisk({ paths, excluded });
      const unused = await runStep(
        "unused",
        () =>
          scanUnusedFiles({
            paths,
            excluded,
            days: FULL_SCAN.unusedDays,
            minSize: FULL_SCAN.unusedMinSize,
          }),
        [],
      );
      const large = await runStep(
        "large",
        () => scanLargeFiles({ paths, excluded, minSize: FULL_SCAN.largeMinSize }),
        [],
      );
      const duplicates = await runStep(
        "duplicates",
        () => scanDuplicates({ paths, excluded, minSize: FULL_SCAN.duplicateMinSize }),
        [],
      );

      if (cancelled.current) issues.push("Đã dừng quét; kết quả chỉ gồm các bước đã chạy xong.");
      const next = {
        report,
        findings: mergeFindings({ analyzer: report.findings, unused, large, duplicates }),
      };
      setResult(next);
      return next;
    } catch (e) {
      issues.push(errorText(e));
      return null;
    } finally {
      setErrors(issues);
      setStep(null);
    }
  }, []);

  const stop = useCallback(() => {
    cancelled.current = true;
    void cancelScan();
  }, []);

  return { result, setResult, step, errors, start, stop, running: step !== null };
}
