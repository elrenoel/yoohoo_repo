import AppShell from "@/components/layout/AppShell";
import DeckCardSkeleton from "@/components/desk/DeckCardSkeleton";

export default function Loading() {
  return (
    <AppShell>
      <main className="min-h-screen bg-bg px-5 py-10 pb-28 text-text sm:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary">WORKSPACE</p>
              <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Your Desk</h1>
            </div>
            <div className="h-10 w-28 animate-pulse rounded-xl bg-skeleton" />
          </header>

          <div role="status" aria-busy="true" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <span className="sr-only">Memuat meja kerja...</span>
            {Array.from({ length: 6 }, (_, index) => <DeckCardSkeleton key={index} />)}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
