/**
 * Placeholder shaped like DeckCard (same border, padding, gaps and footer) so
 * swapping it for real data causes no layout shift. The priority strip is
 * content-dependent, so the skeleton matches the plain (no-strip) card.
 */
export default function DeckCardSkeleton() {
  return (
    <div aria-hidden className="rounded-2xl border border-border bg-surface">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-skeleton-highlight" />
              <div className="h-7 w-2/3 animate-pulse rounded bg-skeleton-highlight" />
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-[21px] w-full animate-pulse rounded bg-skeleton" />
              <div className="h-[21px] w-4/5 animate-pulse rounded bg-skeleton" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-skeleton" />
            <div className="h-8 w-8 animate-pulse rounded-lg bg-skeleton" />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="h-6 w-28 animate-pulse rounded-md bg-skeleton" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-8 animate-pulse rounded bg-skeleton" />
          <div className="h-4 w-8 animate-pulse rounded bg-skeleton" />
          <div className="h-4 w-8 animate-pulse rounded bg-skeleton" />
        </div>
        <div className="h-4 w-12 animate-pulse rounded bg-skeleton" />
      </div>
    </div>
  );
}
