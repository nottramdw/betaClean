import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const VERSION = "1.5.4";
const ROOT = resolve(import.meta.dirname, "..");
const TARGET = join(ROOT, "src-tauri", "resources", "clamav");
const KEEP_FILES = /^(clamscan\.exe|freshclam\.exe|.+\.dll|COPYING\.txt|README\.md)$/i;
const KEEP_DIRS = ["certs", "COPYING"];

function placeholder() {
  mkdirSync(TARGET, { recursive: true });
  writeFileSync(join(TARGET, ".keep"), "");
}

if (process.platform !== "win32") {
  placeholder();
  console.log("Bỏ qua: ClamAV chỉ được đóng gói sẵn cho Windows. macOS dùng bản cài qua Homebrew.");
  process.exit(0);
}

if (existsSync(join(TARGET, "clamscan.exe")) && !process.argv.includes("--force")) {
  console.log(`ClamAV đã có tại ${TARGET}`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), "betaclean-clamav-"));
const name = `clamav-${VERSION}.win.x64`;
const url = `https://github.com/Cisco-Talos/clamav/releases/download/clamav-${VERSION}/${name}.zip`;
const archive = join(work, `${name}.zip`);

try {
  console.log(`Tải ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Tải thất bại: HTTP ${response.status}`);
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));

  const extracted = join(work, "out");
  mkdirSync(extracted);
  execFileSync(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), [
    "-xf",
    archive,
    "-C",
    extracted,
  ]);
  const source = join(extracted, name);

  rmSync(TARGET, { recursive: true, force: true });
  mkdirSync(TARGET, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const keep = entry.isDirectory() ? KEEP_DIRS.includes(entry.name) : KEEP_FILES.test(entry.name);
    if (keep) cpSync(join(source, entry.name), join(TARGET, entry.name), { recursive: true });
  }
  writeFileSync(join(TARGET, ".keep"), "");
  console.log(`Đã chuẩn bị ClamAV ${VERSION} tại ${TARGET}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
