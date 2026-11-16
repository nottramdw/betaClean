import {
  Archive,
  Clock,
  Copy,
  FileBox,
  Gauge,
  History,
  MemoryStick,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type PageId =
  | "overview"
  | "junk"
  | "large-files"
  | "duplicates"
  | "unused"
  | "memory"
  | "antivirus"
  | "quarantine"
  | "history";

export const PAGES: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Tổng quan", icon: Gauge },
  { id: "junk", label: "Tệp rác", icon: Sparkles },
  { id: "large-files", label: "Tệp lớn", icon: FileBox },
  { id: "duplicates", label: "Tệp trùng lặp", icon: Copy },
  { id: "unused", label: "Lâu không dùng", icon: Clock },
  { id: "memory", label: "Bộ nhớ RAM", icon: MemoryStick },
  { id: "antivirus", label: "Quét virus", icon: ShieldCheck },
  { id: "quarantine", label: "Khu cách ly", icon: Archive },
  { id: "history", label: "Lịch sử", icon: History },
];
