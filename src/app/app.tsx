import { useRef, useState, type ReactNode } from "react";
import { AntivirusPage } from "../features/antivirus/antivirus-page";
import { HistoryPage } from "../features/history/history-page";
import { JunkPage } from "../features/junk/junk-page";
import { MemoryPage } from "../features/memory/memory-page";
import { OverviewPage } from "../features/overview/overview-page";
import { QuarantinePage } from "../features/quarantine/quarantine-page";
import { DuplicatesPage } from "../features/scan/duplicates-page";
import { LargeFilesPage } from "../features/scan/large-files-page";
import { UnusedPage } from "../features/unused/unused-page";
import { useMediaQuery } from "../shared/hooks/use-media-query";
import { PageActiveContext } from "../shared/ui/page-active";
import type { PageId } from "./pages";
import { ScrollTopButton } from "./scroll-top-button";
import { Sidebar } from "./sidebar";

type SidebarMode = "rail" | "full";

const SIDEBAR_KEY = "betaclean.sidebar";
const SCROLL_TOP_AFTER = 480;

function readMode(): SidebarMode | null {
  try {
    const value = window.localStorage.getItem(SIDEBAR_KEY);
    return value === "rail" || value === "full" ? value : null;
  } catch {
    return null;
  }
}

function saveMode(mode: SidebarMode) {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, mode);
  } catch {
    return;
  }
}

export function App() {
  const [page, setPage] = useState<PageId>("overview");
  const narrow = useMediaQuery("(max-width: 1199px)");
  const [mode, setMode] = useState<SidebarMode | null>(readMode);
  const rail = mode ? mode === "rail" : narrow;
  const mainRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const select = (next: PageId) => {
    setPage(next);
    mainRef.current?.scrollTo({ top: 0 });
  };

  const scrollTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mainRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  const toggle = () => {
    const next: SidebarMode = rail ? "full" : "rail";
    setMode(next);
    saveMode(next);
  };

  const views: Record<PageId, ReactNode> = {
    overview: <OverviewPage />,
    junk: <JunkPage />,
    "large-files": <LargeFilesPage />,
    duplicates: <DuplicatesPage />,
    unused: <UnusedPage />,
    memory: <MemoryPage active={page === "memory"} />,
    antivirus: <AntivirusPage />,
    quarantine: <QuarantinePage active={page === "quarantine"} />,
    history: <HistoryPage active={page === "history"} />,
  };

  return (
    <div className="app-shell h-full font-sans text-slate-800" data-rail={rail}>
      <Sidebar current={page} onSelect={select} rail={rail} onToggle={toggle} />
      <main
        ref={mainRef}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > SCROLL_TOP_AFTER)}
        className="@container ml-(--sidebar-w) h-full overflow-y-auto transition-[margin] duration-200 ease-out"
      >
        <div className="mx-auto max-w-(--content-max) px-6 py-6 @5xl:px-8 @5xl:py-8 @[100rem]:px-10">
          {(Object.keys(views) as PageId[]).map((id) => (
            <div key={id} hidden={id !== page}>
              <PageActiveContext.Provider value={id === page}>
                {views[id]}
              </PageActiveContext.Provider>
            </div>
          ))}
          <div aria-hidden className="h-(--action-bar-h)" />
        </div>
      </main>
      <ScrollTopButton visible={scrolled} onClick={scrollTop} />
    </div>
  );
}
