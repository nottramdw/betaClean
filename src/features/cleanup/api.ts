import { invoke } from "@tauri-apps/api/core";

export type CleanupFailure = { target: string; error: string };

export type CleanupReport = {
  succeeded: string[];
  failed: CleanupFailure[];
  bytes: number;
};

export type QuarantineEntry = {
  id: string;
  originalPath: string;
  reason: string;
  size: number;
  quarantinedAt: number;
};

export type CleanupAction = "trash" | "quarantine" | "restore" | "delete";

export type HistoryEntry = {
  time: number;
  action: CleanupAction;
  path: string;
  size: number;
  success: boolean;
  error?: string;
};

export function moveToTrash(paths: string[]): Promise<CleanupReport> {
  return invoke("move_to_trash", { paths, confirmed: true });
}

export function quarantineFiles(items: { path: string; reason: string }[]): Promise<CleanupReport> {
  return invoke("quarantine_files", { items, confirmed: true });
}

export function listQuarantine(): Promise<QuarantineEntry[]> {
  return invoke("list_quarantine");
}

export function restoreQuarantined(ids: string[]): Promise<CleanupReport> {
  return invoke("restore_quarantined", { ids, confirmed: true });
}

export function deleteQuarantined(ids: string[]): Promise<CleanupReport> {
  return invoke("delete_quarantined", { ids, confirmed: true });
}

export function getCleanupHistory(limit?: number): Promise<HistoryEntry[]> {
  return invoke("get_cleanup_history", { limit });
}
