"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { LoaderCircle, RefreshCw, Search, Users } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import PostComposer from "@/components/posts/PostComposer";
import PostCard, { type SocialPostItem } from "@/components/posts/PostCard";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/lib/toast";
import UserAvatar from "@/components/profile/UserAvatar";

type FeedPage = {
  items: SocialPostItem[];
  nextCursor: string | null;
  hasFollowing: boolean;
};

async function fetchFeed(
  cursor: string | null,
  signal: AbortSignal,
): Promise<FeedPage> {
  const response = await fetch(
    `/api/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    { signal },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The feed could not be loaded.");
  return data;
}

export default function HomeFeed() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const sentinel = useRef<HTMLDivElement>(null);
  const feed = useInfiniteQuery({
    queryKey: queryKeys.feed,
    queryFn: ({ pageParam, signal }) => fetchFeed(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  });
  const hasFollowing = feed.data?.pages[0]?.hasFollowing ?? true;
  const suggestions = useQuery<{ items: SocialPostItem[] }>({
    queryKey: queryKeys.feedSuggestions,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/feed/suggestions", { signal });
      if (!response.ok) throw new Error("Recommendations could not be loaded.");
      return response.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const items = useMemo(() => {
    const all = feed.data?.pages.flatMap((page) => page.items) ?? [];
    return [
      ...new Map(all.map((item) => [`${item.type}:${item.id}`, item])).values(),
    ];
  }, [feed.data]);
  const shown = hasFollowing ? items : (suggestions.data?.items ?? []);
  const loading = feed.isPending || (!hasFollowing && suggestions.isPending);
  const people = useMemo(() => {
    const source = [...items, ...(suggestions.data?.items ?? [])];
    return [
      ...new Map(
        source.map((item) => [item.author.username, item.author]),
      ).values(),
    ].slice(0, 5);
  }, [items, suggestions.data]);
  const recommendedDecks = (suggestions.data?.items ?? [])
    .filter((item) => item.type === "deck")
    .slice(0, 3);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feed;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage)
          void fetchNextPage();
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  async function refresh() {
    try {
      await feed.refetch();
      toast.success("Feed refreshed.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The feed could not be loaded.",
      );
    }
  }
  function posted() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.feedRoot });
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-bg text-text">
        <div className="flex w-full gap-8 px-8 pb-24 pt-6 xl:gap-8">
          <div className="shrink-0 flex-1 flex justify-center">
            <section className="w-full min-w-0 max-w-[720px] xl:min-w-[720px]">
              <div className="[&>section]:rounded-xl [&>section]:border-border-strong [&>section]:p-4 [&_textarea]:min-h-14">
                <PostComposer onPosted={posted} />
              </div>
              <div className="mt-5 flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-5 text-sm">
                  <button className="border-b-2 border-accent pb-3 font-semibold">
                    For you
                  </button>
                  <span className="pb-3 text-text-muted">Following</span>
                </div>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={feed.isFetching}
                  aria-label="Refresh feed"
                  className="rounded-full p-2 text-text-secondary transition hover:bg-surface-hover hover:text-accent disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${feed.isFetching ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
              {!hasFollowing && !loading && (
                <section className="mt-5 border-l-2 border-danger bg-surface p-5">
                  <h2 className="text-lg font-semibold">
                    Your feed is just getting started
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Follow other learners to see their posts and decks here.
                  </p>
                  <Link
                    href="/explore"
                    className="mt-3 inline-block text-sm font-semibold text-accent"
                  >
                    Explore the community →
                  </Link>
                </section>
              )}
              <div className="w-full min-w-0 divide-y divide-border [&>article]:border-x-0 [&>article]:border-t-0 [&>article]:bg-transparent [&>article]:px-0 [&>article]:py-6">
                {loading && !shown.length
                  ? [1, 2, 3].map((item) => <Skeleton key={item} />)
                  : shown.map((item) => (
                      <PostCard key={`${item.type}:${item.id}`} item={item} />
                    ))}
              </div>
              {hasFollowing && (
                <div ref={sentinel} className="py-8 text-center">
                  {isFetchingNextPage && (
                    <LoaderCircle className="mx-auto animate-spin" />
                  )}
                </div>
              )}
              {!loading && !shown.length && (
                <div className="border-b border-border py-16 text-center text-sm text-text-secondary">
                  No published content yet.
                </div>
              )}
            </section>
          </div>

          <aside className="hidden xl:flex">
            <div className="sticky top-6 space-y-4">
              <form
                action="/explore"
                className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <Search className="h-4 w-4 text-text-secondary" />
                <input
                  name="q"
                  placeholder="Search Yoohoo"
                  aria-label="Search Yoohoo"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
                />
              </form>
              <section className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Learners to discover</h2>
                  <Users className="h-4 w-4 text-text-secondary" />
                </div>
                <div className="mt-4 space-y-4">
                  {people.map((person) => (
                    <Link
                      key={person.username}
                      href={`/profile/${person.username}`}
                      className="group flex items-center gap-3"
                    >
                      <UserAvatar src={person.avatarUrl} name={person.displayName} size={36} textClassName="text-xs"/>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold group-hover:underline">
                          {person.displayName}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          @{person.username}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-accent">
                        View
                      </span>
                    </Link>
                  ))}
                  {!people.length && <RightRailSkeleton />}
                </div>
              </section>
              <section className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Recommended decks</h2>
                  <Link
                    href="/explore?tab=deck"
                    className="text-xs text-text-secondary hover:underline"
                  >
                    See all
                  </Link>
                </div>
                <div className="mt-4 space-y-4">
                  {recommendedDecks.map((deck) => (
                    <Link
                      key={deck.id}
                      href={`/d/${deck.slug}`}
                      className="group flex gap-3"
                    >
                      <GradientFolderIcon />
                      <span className="min-w-0">
                        <span className="block line-clamp-1 text-sm font-semibold group-hover:underline">
                          {deck.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-text-muted">
                          by @{deck.author.username}
                        </span>
                      </span>
                    </Link>
                  ))}
                  {!recommendedDecks.length && <RightRailSkeleton />}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function Skeleton() {
  return (
    <div
      className="box-border w-full min-w-0 py-6 xl:w-[720px] xl:min-w-[720px]"
      role="status"
      aria-label="Loading post"
    >
      <div className="flex w-full gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-skeleton" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-52 animate-pulse rounded bg-skeleton" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-skeleton" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-skeleton" />
          <div className="mt-5 h-64 w-full animate-pulse rounded-2xl bg-skeleton" />
          <div className="mt-5 flex gap-6">
            <div className="h-4 w-12 animate-pulse rounded bg-skeleton" />
            <div className="h-4 w-12 animate-pulse rounded bg-skeleton" />
            <div className="h-4 w-12 animate-pulse rounded bg-skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}
function RightRailSkeleton() {
  return (
    <div className="space-y-3" role="status">
      <div className="h-9 animate-pulse rounded-lg bg-surface-hover" />
      <div className="h-9 animate-pulse rounded-lg bg-surface-hover" />
    </div>
  );
}

function GradientFolderIcon() {
  const gradientId = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 40 34"
      aria-hidden="true"
      className="h-9 w-10 shrink-0 drop-shadow-[0_2px_3px_rgba(22,76,61,0.14)]"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="2" x2="31" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--success)" />
          <stop offset="0.52" stopColor="var(--accent-hover)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M3 7.5A4.5 4.5 0 0 1 7.5 3H16l3.4 4H32.5A4.5 4.5 0 0 1 37 11.5v14A5.5 5.5 0 0 1 31.5 31h-24A4.5 4.5 0 0 1 3 26.5v-19Z"
      />
      <path
        fill="var(--text)"
        fillOpacity="0.16"
        d="M7.5 4.7h7.8l3.4 4H33a2.3 2.3 0 0 1 2.2 1.7H4.8V7.5a2.7 2.7 0 0 1 2.7-2.8Z"
      />
    </svg>
  );
}
