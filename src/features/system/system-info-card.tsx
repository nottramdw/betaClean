import { useEffect, useState } from "react";
import { getSystemInfo, type SystemInfo } from "./api";

export function SystemInfoCard() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSystemInfo()
      .then(setInfo)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!info) return <p className="text-sm text-slate-500">Đang tải...</p>;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-slate-500">Phiên bản</dt>
      <dd>{info.appVersion}</dd>
      <dt className="text-slate-500">Hệ điều hành</dt>
      <dd>{info.os}</dd>
      <dt className="text-slate-500">Kiến trúc</dt>
      <dd>{info.arch}</dd>
    </dl>
  );
}
