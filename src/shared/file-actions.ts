import { invoke } from "@tauri-apps/api/core";

export function revealPath(path: string): Promise<void> {
  return invoke("reveal_path", { path });
}

function copyWithSelection(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Không sao chép được đường dẫn.");
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    copyWithSelection(text);
  }
}
