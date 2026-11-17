import { useEffect, useState } from "react";
import { joinPath } from "../../shared/format";
import { loadHomeDir } from "../../shared/hooks/use-home-dir";
import { listVolumes } from "../overview/api";

export type ScanScope = { home: string; drives: string[]; paths: string[]; excluded: string[] };

const SYSTEM_FOLDERS = [
  "$RECYCLE.BIN",
  "System Volume Information",
  ".Trashes",
  ".Spotlight-V100",
  ".fseventsd",
  ".DocumentRevisions-V100",
  ".TemporaryItems",
  "Backups.backupdb",
];

function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function contains(root: string, path: string): boolean {
  const base = normalize(root);
  const target = normalize(path);
  return base === "" || target === base || target.startsWith(`${base}/`);
}

export async function loadScanScope(): Promise<ScanScope> {
  const [home, volumes] = await Promise.all([loadHomeDir(), listVolumes()]);
  const drives = volumes.map((v) => v.mount).filter((mount) => !contains(mount, home));
  return {
    home,
    drives,
    paths: [home, ...drives],
    excluded: drives.flatMap((drive) => SYSTEM_FOLDERS.map((name) => joinPath(drive, name))),
  };
}

export function driveName(drive: string): string {
  const parts = drive.split(/[\\/]/).filter(Boolean);
  return /^[a-z]:$/i.test(parts[0] ?? "") ? drive : (parts[parts.length - 1] ?? drive);
}

export function scopeLabel(scope: ScanScope | null): string | null {
  return scope ? scope.paths.join(", ") : null;
}

export function useScanScope(): ScanScope | null {
  const [scope, setScope] = useState<ScanScope | null>(null);

  useEffect(() => {
    let alive = true;
    loadScanScope()
      .then((next) => {
        if (alive) setScope(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return scope;
}
