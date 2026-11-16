import { useState, type ReactNode } from "react";
import { AntivirusPage } from "../features/antivirus/antivirus-page";
import { HistoryPage } from "../features/history/history-page";
import { JunkPage } from "../features/junk/junk-page";
import { OverviewPage } from "../features/overview/overview-page";
import { QuarantinePage } from "../features/quarantine/quarantine-page";
import { DuplicatesPage } from "../features/scan/duplicates-page";
import { LargeFilesPage } from "../features/scan/large-files-page";
import { UnusedPage } from "../features/unused/unused-page";
import type { PageId } from "./pages";
import { Sidebar } from "./sidebar";

export function App() {
  const [page, setPage] = useState<PageId>("overview");

  const views: Record<PageId, ReactNode> = {
    overview: <OverviewPage />,
    junk: <JunkPage />,
    "large-files": <LargeFilesPage />,
    duplicates: <DuplicatesPage />,
    unused: <UnusedPage />,
    antivirus: <AntivirusPage />,
    quarantine: <QuarantinePage active={page === "quarantine"} />,
    history: <HistoryPage active={page === "history"} />,
  };

  return (
    <div className="h-full font-sans text-slate-800">
      <Sidebar current={page} onSelect={setPage} />
      <main className="ml-[232px] h-full overflow-y-auto">
        <div className="mx-auto max-w-[1200px] px-8 py-8">
          {(Object.keys(views) as PageId[]).map((id) => (
            <div key={id} hidden={id !== page}>
              {views[id]}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
