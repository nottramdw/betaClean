import type { DuplicateFile, DuplicateGroup } from "./api";

export function storageCount(files: DuplicateFile[]): number {
  return new Set(files.map((f) => f.storage)).size;
}

export function reclaimableOf(size: number, files: DuplicateFile[]): number {
  return size * Math.max(0, storageCount(files) - 1);
}

export function newestFile(files: DuplicateFile[]): DuplicateFile {
  return files.reduce((best, f) => (f.modified > best.modified ? f : best), files[0]);
}

export function redundantCopies(files: DuplicateFile[]): DuplicateFile[] {
  const keep = newestFile(files);
  return files.filter((f) => f.storage !== keep.storage);
}

export function sharesStorage(files: DuplicateFile[], file: DuplicateFile): boolean {
  return files.some((other) => other !== file && other.storage === file.storage);
}

export function freedBy(group: DuplicateGroup, selected: ReadonlySet<string>): number {
  const storages = new Set(group.files.map((f) => f.storage));
  let freed = 0;
  for (const storage of storages) {
    const members = group.files.filter((f) => f.storage === storage);
    if (members.every((f) => selected.has(f.path))) freed += group.size;
  }
  return freed;
}
