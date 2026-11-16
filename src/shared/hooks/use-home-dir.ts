import { homeDir } from "@tauri-apps/api/path";
import { useEffect, useState } from "react";

let cached: Promise<string> | null = null;

export function loadHomeDir(): Promise<string> {
  cached ??= homeDir();
  return cached;
}

export function useHomeDir(): string | null {
  const [home, setHome] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadHomeDir().then((dir) => {
      if (alive) setHome(dir);
    });
    return () => {
      alive = false;
    };
  }, []);

  return home;
}
