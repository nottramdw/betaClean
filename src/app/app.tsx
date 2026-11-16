import { SystemInfoCard } from "../features/system/system-info-card";

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <h1 className="mb-6 text-2xl font-semibold">betaClean</h1>
      <section className="max-w-sm rounded-lg border border-slate-200 bg-white p-4">
        <SystemInfoCard />
      </section>
    </main>
  );
}
