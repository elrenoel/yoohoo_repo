import AppShell from "@/components/layout/AppShell";
import DeckCardSkeleton from "@/components/desk/DeckCardSkeleton";

export default function Loading() {
  return (
    <AppShell>
      <main className="min-h-screen bg-[#F5F6F3] px-5 py-10 pb-28 text-[#16241D] sm:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5B6B62]">TRASH</p>
              <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Trash</h1>
              <p className="mt-1 text-sm text-[#5B6B62]">Deck dihapus otomatis setelah 30 hari.</p>
            </div>
            <div className="h-10 w-28 animate-pulse rounded-xl bg-[#E4E8E0]" />
          </header>

          <div role="status" aria-busy="true" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <span className="sr-only">Memuat trash...</span>
            {Array.from({ length: 6 }, (_, index) => <DeckCardSkeleton key={index} />)}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
