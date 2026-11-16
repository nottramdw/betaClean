export type Safety = "an-toan" | "can-xem-xet" | "chi-thong-bao" | "khong-dong-vao";

export const SAFETY_LABEL: Record<Safety, string> = {
  "an-toan": "An toàn",
  "can-xem-xet": "Cần xem xét",
  "chi-thong-bao": "Chỉ thông báo",
  "khong-dong-vao": "Không đụng vào",
};

export const SAFETY_STYLE: Record<Safety, string> = {
  "an-toan": "bg-green-50 text-safe border-green-200",
  "can-xem-xet": "bg-amber-50 text-review border-amber-200",
  "chi-thong-bao": "bg-slate-100 text-info border-slate-200",
  "khong-dong-vao": "bg-slate-100 text-info border-slate-200",
};

export function isCleanable(safety: Safety): boolean {
  return safety === "an-toan" || safety === "can-xem-xet";
}
