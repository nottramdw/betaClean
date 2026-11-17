import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import { PAGES, type PageId } from "./pages";

export function Sidebar({
  current,
  onSelect,
  rail,
  onToggle,
}: {
  current: PageId;
  onSelect: (id: PageId) => void;
  rail: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-(--sidebar-w) flex-col border-r border-line bg-white transition-[width] duration-200 ease-out">
      <div
        className={`flex h-[76px] shrink-0 items-center gap-3 ${rail ? "justify-center" : "px-5"}`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-white shadow-card">
          <ShieldCheck size={20} />
        </div>
        {!rail && (
          <div className="min-w-0">
            <p className="text-base font-bold tracking-tight text-slate-900">betaClean</p>
            <p className="truncate text-xs text-slate-500">Dọn dẹp hệ thống</p>
          </div>
        )}
      </div>
      <nav
        aria-label="Chức năng"
        className={`flex-1 space-y-0.5 px-3 py-2 ${rail ? "overflow-visible" : "overflow-y-auto"}`}
      >
        {PAGES.map(({ id, label, icon: Icon }) => {
          const selected = id === current;
          return (
            <button
              key={id}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onSelect(id)}
              className={`group relative flex h-11 w-full items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
                rail ? "justify-center" : "px-3"
              } ${
                selected
                  ? "bg-primary-soft text-primary"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {selected && !rail && (
                <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-primary" />
              )}
              <Icon size={18} className="shrink-0" />
              <span className={rail ? "sr-only" : "truncate"}>{label}</span>
              {rail && <Tooltip text={label} />}
            </button>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-line px-3 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!rail}
          aria-label={rail ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          className={`group relative flex h-11 w-full items-center gap-3 rounded-lg text-sm text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 ${
            rail ? "justify-center" : "px-3"
          }`}
        >
          {rail ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!rail && <span>Thu gọn</span>}
          {rail && <Tooltip text="Mở rộng" />}
        </button>
        <div
          className={`mt-1 flex h-8 items-center gap-2 text-xs text-slate-500 ${rail ? "justify-center" : "px-3"}`}
          title="Hoạt động offline"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-safe" />
          <span className={rail ? "sr-only" : ""}>Hoạt động offline</span>
        </div>
      </div>
    </aside>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
    >
      {text}
    </span>
  );
}
