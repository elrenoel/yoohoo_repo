import AppShell from "@/components/layout/AppShell";
import DeckCardSkeleton from "@/components/desk/DeckCardSkeleton";

export default function Loading() {
  return (
    <AppShell>
      <main className="min-h-screen bg-canvas-soft px-5 py-10 pb-28 text-text sm:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary">TRASH</p>
              <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Trash</h1>
              <p className="mt-1 text-sm text-text-secondary">Decks are automatically deleted after 30 days.</p>
            </div>
            <div className="skeleton-shimmer h-10 w-28 rounded-xl" />
          </header>

          <div role="status" aria-busy="true" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <span className="sr-only">Loading Trash...</span>
            {Array.from({ length: 6 }, (_, index) => <DeckCardSkeleton key={index} />)}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
