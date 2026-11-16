import { invoke } from "@tauri-apps/api/core";

export type Engine = "clamav" | "defender";

export type AntivirusStatus = {
  clamscan?: string | null;
  freshclam?: string | null;
  defender?: string | null;
  databaseDir: string;
  databaseReady: boolean;
  databaseUpdated?: number | null;
};

export type Threat = { path: string; name: string; engine: Engine };

export type VirusScanResult = {
  threats: Threat[];
  enginesUsed: Engine[];
  errors: string[];
};

export const ENGINE_LABEL: Record<Engine, string> = {
  clamav: "ClamAV",
  defender: "Microsoft Defender",
};

export function antivirusStatus(): Promise<AntivirusStatus> {
  return invoke("antivirus_status");
}

export function updateVirusDatabase(): Promise<string> {
  return invoke("update_virus_database");
}

export function scanViruses(paths: string[]): Promise<VirusScanResult> {
  return invoke("scan_viruses", { options: { paths } });
}
