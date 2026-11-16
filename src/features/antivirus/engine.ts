import {
  antivirusStatus,
  scanViruses,
  updateVirusDatabase,
  type AntivirusStatus,
  type Engine,
  type VirusScanResult,
} from "./api";

const DAY = 86_400;

export type MergedThreat = { path: string; names: string[]; engines: Engine[] };

export function hasEngine(status: AntivirusStatus): boolean {
  return Boolean(
    status.defender || (status.clamscan && (status.databaseReady || status.freshclam)),
  );
}

function stale(status: AntivirusStatus): boolean {
  if (!status.databaseReady || !status.databaseUpdated) return true;
  return Date.now() / 1000 - status.databaseUpdated > DAY;
}

export async function scanWithFreshDatabase(paths: string[]): Promise<VirusScanResult> {
  const status = await antivirusStatus();
  const notes: string[] = [];
  if (status.clamscan && status.freshclam && stale(status)) {
    try {
      await updateVirusDatabase();
    } catch {
      if (!status.databaseReady) {
        notes.push("Không tải được cơ sở dữ liệu ClamAV (cần kết nối mạng lần đầu).");
      }
    }
  }
  const result = await scanViruses(paths);
  return { ...result, errors: [...notes, ...result.errors] };
}

export function mergeThreats(result: VirusScanResult): MergedThreat[] {
  const byPath = new Map<string, MergedThreat>();
  for (const threat of result.threats) {
    const entry = byPath.get(threat.path) ?? { path: threat.path, names: [], engines: [] };
    if (!entry.names.includes(threat.name)) entry.names.push(threat.name);
    if (!entry.engines.includes(threat.engine)) entry.engines.push(threat.engine);
    byPath.set(threat.path, entry);
  }
  return [...byPath.values()];
}
