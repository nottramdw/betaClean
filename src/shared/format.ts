const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 ? 0 : 1;
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: digits })} ${UNITS[unit]}`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("vi-VN");
}

export function formatDate(seconds: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(seconds: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fileName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function parentDir(path: string): string {
  const index = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return index > 0 ? path.slice(0, index) : path;
}

export function shortenPath(path: string, max = 64): string {
  if (path.length <= max) return path;
  const keep = max - 1;
  const head = Math.ceil(keep * 0.4);
  return `${path.slice(0, head)}…${path.slice(path.length - (keep - head))}`;
}

export function joinPath(base: string, name: string): string {
  const separator = base.includes("\\") ? "\\" : "/";
  return base.endsWith(separator) ? `${base}${name}` : `${base}${separator}${name}`;
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
