import { ArrowUp } from "lucide-react";

export function ScrollTopButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Cuộn lên đầu trang"
      title="Cuộn lên đầu trang"
      tabIndex={visible ? 0 : -1}
      onClick={onClick}
      className={`fixed right-6 bottom-[calc(var(--action-bar-h)+1.5rem)] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-slate-600 shadow-dialog transition-[opacity,transform,bottom,color] duration-200 ease-out hover:text-primary active:scale-95 ${
        visible ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp size={18} />
    </button>
  );
}
