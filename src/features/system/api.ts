import { invoke } from "@tauri-apps/api/core";

export type SystemInfo = {
  appVersion: string;
  os: string;
  arch: string;
};

export function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>("get_system_info");
}
