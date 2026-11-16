import { invoke } from "@tauri-apps/api/core";
import type { CleanupReport } from "../cleanup/api";

export type AppUsage = {
  id: string;
  name: string;
  path: string | null;
  memory: number;
  cpu: number;
  pids: number[];
  protected: string | null;
};

export type MemoryReport = {
  total: number;
  used: number;
  available: number;
  swapTotal: number;
  swapUsed: number;
  apps: AppUsage[];
};

export function memoryUsage(): Promise<MemoryReport> {
  return invoke("memory_usage");
}

export function stopProcesses(pids: number[], force: boolean): Promise<CleanupReport> {
  return invoke("stop_processes", { pids, force, confirmed: true });
}
