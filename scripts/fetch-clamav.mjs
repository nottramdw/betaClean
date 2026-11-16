import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
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
const RELEASE = `https://github.com/Cisco-Talos/clamav/releases/download/clamav-${VERSION}`;
const MARKER = process.platform === "win32" ? "clamscan.exe" : "clamscan";

const WINDOWS_FILES = /^(clamscan\.exe|freshclam\.exe|.+\.dll|COPYING\.txt|README\.md)$/i;
const WINDOWS_DIRS = ["certs", "COPYING"];
const MAC_PROGRAMS = ["clamscan", "freshclam"];
const MAC_LIBRARIES = [
  "libclamav.12.dylib",
  "libclammspack.0.dylib",
  "libfreshclam.4.dylib",
  "libclamunrar.12.dylib",
  "libclamunrar_iface.12.dylib",
];

async function download(url, file) {
  console.log(`Tải ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Tải thất bại: HTTP ${response.status}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

async function prepareWindows(work) {
  const name = `clamav-${VERSION}.win.x64`;
  const archive = join(work, `${name}.zip`);
  await download(`${RELEASE}/${name}.zip`, archive);
  const extracted = join(work, "out");
  mkdirSync(extracted);
  run(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), [
    "-xf",
    archive,
    "-C",
    extracted,
  ]);
  const source = join(extracted, name);
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const keep = entry.isDirectory()
      ? WINDOWS_DIRS.includes(entry.name)
      : WINDOWS_FILES.test(entry.name);
    if (keep) cpSync(join(source, entry.name), join(TARGET, entry.name), { recursive: true });
  }
}

function findPayload(expanded, component) {
  const dir = readdirSync(expanded).find((name) => name.includes(component));
  if (!dir) throw new Error(`Không thấy gói ${component} trong pkg`);
  return join(expanded, dir, "Payload", "usr", "local", "clamav");
}

async function prepareMac(work) {
  const name = `clamav-${VERSION}.macos.universal`;
  const archive = join(work, `${name}.pkg`);
  await download(`${RELEASE}/${name}.pkg`, archive);
  const expanded = join(work, "expanded");
  run("pkgutil", ["--expand-full", archive, expanded]);
  const programs = findPayload(expanded, "programs");
  const libraries = findPayload(expanded, "libraries");

  for (const program of MAC_PROGRAMS) {
    const file = join(TARGET, program);
    copyFileSync(join(programs, "bin", program), file);
    chmodSync(file, 0o755);
    run("install_name_tool", ["-add_rpath", "@executable_path", file]);
  }
  for (const library of MAC_LIBRARIES) {
    const file = join(TARGET, library);
    copyFileSync(join(libraries, "lib", library), file);
    chmodSync(file, 0o644);
    run("install_name_tool", ["-add_rpath", "@loader_path", file]);
  }
  cpSync(join(programs, "etc", "certs"), join(TARGET, "certs"), { recursive: true });
  const identity = process.env.APPLE_SIGNING_IDENTITY;
  const sign = identity
    ? ["--force", "--options", "runtime", "--timestamp", "--sign", identity]
    : ["--force", "--sign", "-"];
  for (const file of [...MAC_LIBRARIES, ...MAC_PROGRAMS]) {
    run("codesign", [...sign, join(TARGET, file)]);
  }
  run(join(TARGET, "clamscan"), ["--version"]);
}

if (!["win32", "darwin"].includes(process.platform)) {
  console.log("Bỏ qua: chỉ đóng gói ClamAV cho Windows và macOS.");
  process.exit(0);
}

if (existsSync(join(TARGET, MARKER)) && !process.argv.includes("--force")) {
  console.log(`ClamAV đã có tại ${TARGET}`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), "betaclean-clamav-"));
try {
  rmSync(TARGET, { recursive: true, force: true });
  mkdirSync(TARGET, { recursive: true });
  if (process.platform === "win32") await prepareWindows(work);
  else await prepareMac(work);
  writeFileSync(join(TARGET, ".keep"), "");
  console.log(`Đã chuẩn bị ClamAV ${VERSION} tại ${TARGET}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
