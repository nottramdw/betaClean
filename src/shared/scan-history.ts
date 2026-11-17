type Entry = { files: number; seconds: number };

type Run = { key: string; started: number; files: number; expected: Entry | null };

const STORAGE_KEY = "betaclean.scan-history";
const runs = new Map<string, Run>();

function load(): Record<string, Entry> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    return data && typeof data === "object" ? (data as Record<string, Entry>) : {};
  } catch {
    return {};
  }
}

function save(data: Record<string, Entry>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    return;
  }
}

function historyKey(tool: string, paths: string[]): string {
  return [tool, ...paths.map((p) => p.toLowerCase()).sort()].join("|");
}

export function recallSeconds(tool: string, paths: string[]): number | null {
  const entry = load()[historyKey(tool, paths)];
  return entry && entry.seconds > 0 ? entry.seconds : null;
}

export async function trackScan<T>(
  tool: string,
  paths: string[],
  task: () => Promise<T>,
): Promise<T> {
  const key = historyKey(tool, paths);
  const run: Run = { key, started: Date.now(), files: 0, expected: load()[key] ?? null };
  runs.set(tool, run);
  try {
    const result = await task();
    save({
      ...load(),
      [key]: { files: run.files, seconds: Math.round((Date.now() - run.started) / 1000) },
    });
    return result;
  } finally {
    if (runs.get(tool) === run) runs.delete(tool);
  }
}

export function noteCollected(tool: string, files: number) {
  const run = runs.get(tool);
  if (run && files > run.files) run.files = files;
}

export function expectedFiles(tool: string): number | null {
  const files = runs.get(tool)?.expected?.files;
  return files && files > 0 ? files : null;
}
