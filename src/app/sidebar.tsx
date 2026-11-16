import { ShieldCheck } from "lucide-react";
import { PAGES, type PageId } from "./pages";

export function Sidebar({
  current,
  onSelect,
}: {
  current: PageId;
  onSelect: (id: PageId) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[232px] flex-col border-r border-line bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
          <ShieldCheck size={20} />
        </div>
        <div>
          <p className="text-base font-bold text-slate-900">betaClean</p>
          <p className="text-xs text-slate-500">Dọn dẹp hệ thống</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {PAGES.map(({ id, label, icon: Icon }) => {
          const selected = id === current;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                selected
                  ? "bg-primary-soft text-primary"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </nav>
      <div className="flex items-center gap-2 border-t border-line px-5 py-4 text-xs text-slate-500">
        <span className="h-2 w-2 rounded-full bg-safe" />
        Hoạt động offline
      </div>
    </aside>
  );
}
