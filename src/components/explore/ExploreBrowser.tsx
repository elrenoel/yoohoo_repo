"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/lib/toast";
import UserAvatar from "@/components/profile/UserAvatar";
import { useSession } from "@/lib/session-provider";

type Tab = "all" | "deck" | "post" | "people";
type Sort = "newest" | "popular" | "proven";
type Item = {
  id: string;
  type: "deck" | "post" | "people";
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  publishedAt: string;
  author: { username: string; displayName: string; avatarUrl: string | null };
  completionCount: number;
  averageScore: number | null;
  popularity: number;
  followedByMe?: boolean;
};
type Tag = { tag: string; count: number };
type ExplorePage = { items: Item[]; people: Item[]; tagMatches: Tag[]; meta:{mode:"idle"|"tag"|"account"|"mixed";query:string;tags?:string[];total:number|null}; nextCursor: string | null };
const tabs: { value: Tab; label: string }[] = [
  { value: "all", label: "Explore" },
  { value: "deck", label: "Decks" },
  { value: "post", label: "Posts" },
  { value: "people", label: "People" },
];

export default function ExploreBrowser() {
  const searchParams = useSearchParams(),
    router = useRouter(),
    pathname = usePathname(),
    toast = useToast();
  const urlQ = searchParams.get("q") || "",
    tab = (searchParams.get("tab") || "all") as Tab,
    tag = searchParams.get("tag") || "",
    sort = (searchParams.get("sort") || "newest") as Sort;
  const [query, setQuery] = useState(urlQ);
  const sentinel = useRef<HTMLDivElement>(null);
  const topicSlider = useRef<HTMLElement>(null);
  const filters = useMemo(
    () => ({ q: urlQ, tab, tag, sort }),
    [urlQ, tab, tag, sort],
  );
  const setFilters = useCallback(
    (patch: Record<string, string>, replace = false) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value && value !== "all" && !(key === "sort" && value === "newest"))
          next.set(key, value);
        else next.delete(key);
      }
      const suffix = next.toString(),
        href = `${pathname}${suffix ? `?${suffix}` : ""}`;
      if (href === `${pathname}${searchParams.size ? `?${searchParams}` : ""}`)
        return;
      (replace ? router.replace : router.push)(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );
  useEffect(() => {
    const normalized = query.trim();
    if (normalized === urlQ) return;
    const timer = window.setTimeout(
      () => setFilters({ q: normalized }, true),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [query, urlQ, setFilters]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setQuery(urlQ), [urlQ]);
  const explore = useInfiniteQuery({
    queryKey: queryKeys.explore(filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams(filters);
      if (pageParam) params.set("cursor", pageParam);
      const response = await fetch(`/api/explore?${params}`, { signal }),
        data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Explore could not be loaded.");
      return data as ExplorePage;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
  const tagQuery = useQuery({
    queryKey: queryKeys.exploreTags,
    queryFn: async () => {
      const response = await fetch("/api/explore/tags");
      if (!response.ok) throw new Error("Topics could not be loaded.");
      return response.json() as Promise<{ tags: Tag[] }>;
    },
    staleTime: 30 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
  const featuredQuery = useQuery({
    queryKey: ["explore", "featured"],
    queryFn: async () => {
      const response = await fetch("/api/explore/featured");
      if (!response.ok) throw new Error("Featured post could not be loaded.");
      return response.json() as Promise<{ item: Item | null }>;
    },
    staleTime: 5 * 60_000,
  });
  const learnersQuery = useQuery({
    queryKey: ["explore", "learners"],
    queryFn: async () => {
      const response = await fetch("/api/explore/learners");
      if (!response.ok) throw new Error("Learners could not be loaded.");
      return response.json() as Promise<{ items: Item[] }>;
    },
    staleTime: 5 * 60_000,
  });
  const items = useMemo(
    () => [
      ...new Map(
        (explore.data?.pages.flatMap((page) => page.items) ?? []).map(
          (item) => [`${item.type}:${item.id}`, item],
        ),
      ).values(),
    ],
    [explore.data],
  );
  const tags = tagQuery.data?.tags ?? [],
    people = learnersQuery.data?.items ?? [];
  const searchMeta=explore.data?.pages[0]?.meta,searchPeople=explore.data?.pages[0]?.people??[],matchedTags=explore.data?.pages[0]?.tagMatches??[],tagMode=searchMeta?.mode==="tag";
  const hasActiveSearch = Boolean(
    urlQ || tag || tab !== "all" || sort !== "newest",
  );
  const featured = hasActiveSearch
    ? items.find((item) => item.type !== "people")
    : (featuredQuery.data?.item ??
      items.find((item) => item.type !== "people"));
  const list = featured
    ? items.filter(
        (item) =>
          `${item.type}:${item.id}` !== `${featured.type}:${featured.id}`,
      )
    : items;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = explore;
  useEffect(() => {
    if (explore.error) toast.error(explore.error.message);
  }, [explore.error, toast]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage)
          void fetchNextPage();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const slideTopics = (direction: -1 | 1) =>
    topicSlider.current?.scrollBy({
      left: direction * 360,
      behavior: "smooth",
    });

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="w-full border-b border-border px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex w-full items-center gap-2">
          <button
            type="button"
            onClick={() => slideTopics(-1)}
            aria-label="Previous topics"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition hover:border-border-strong hover:bg-surface-hover hover:text-text"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <nav
            ref={topicSlider}
            aria-label="Explore topics"
            className="topic-slider flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto px-1 py-1"
          >
            {tabs.filter(item=>!tagMode||item.value!=="people").map((item) => (
              <button
                key={item.value}
                onClick={() => setFilters({ tab: item.value })}
                className={`shrink-0 snap-start rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === item.value ? "bg-action-primary text-on-action-primary" : "bg-surface-subtle text-text-secondary hover:bg-surface-hover"}`}
              >
                {item.label}
              </button>
            ))}
            {tags.map((item) => (
              <button
                key={item.tag}
                onClick={() => {setQuery(`#${item.tag}`);setFilters({q:`#${item.tag}`,tag:"",tab:tab==="people"?"all":tab})}}
                className={`shrink-0 snap-start rounded-lg px-3 py-2 text-xs font-medium transition ${tagMode&&searchMeta?.tags?.includes(item.tag) ? "bg-action-primary text-on-action-primary" : "bg-surface-subtle text-text-secondary hover:bg-surface-hover"}`}
              >
                #{item.tag}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => slideTopics(1)}
            aria-label="Next topics"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition hover:border-border-strong hover:bg-surface-hover hover:text-text"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex w-full gap-8 px-4 pb-24 pt-5 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[900px]">
            <div className="mx-auto w-full max-w-[720px] xl:min-w-[720px]">
              <div className="mb-2 flex items-center justify-between border-b border-border py-3">
                <p className="text-sm font-semibold">
                  {tagMode
                    ? `${searchMeta?.tags?.map(value=>`#${value}`).join(" ")??urlQ}${searchMeta?.total!==null?` · ${searchMeta?.total} posts and decks`:""}`
                    : urlQ
                      ? `Results for “${urlQ}”`
                      : "Discover what to learn next"}
                </p>
                <select
                  value={sort}
                  onChange={(event) => setFilters({ sort: event.target.value })}
                  className="bg-transparent text-xs text-text-secondary outline-none"
                  aria-label="Sort results"
                >
                  <option value="newest">Newest</option>
                  <option value="popular">Popular</option>
                  <option
                    value="proven"
                    disabled={tab === "post" || tab === "people"}
                  >
                    Proven
                  </option>
                </select>
              </div>
              {explore.isPending||explore.isPlaceholderData ? (
                <ExploreSkeleton />
              ) : tagMode&&searchMeta?.total===0 ? (
                <div className="py-20 text-center"><Search className="mx-auto h-8 w-8 text-text-muted"/><h2 className="mt-4 text-xl font-semibold">Tag not found</h2><p className="mt-2 text-sm text-text-secondary">Try one of these similar tags.</p><TagChips tags={matchedTags} onSelect={value=>{setQuery(`#${value}`);setFilters({q:`#${value}`,tag:""})}}/></div>
              ) : featured||items.length||searchPeople.length||matchedTags.length ? (
                <>
                  {searchPeople.length>0&&tab!=="deck"&&tab!=="post"&&<section className="border-b border-border py-5"><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold">People</h2>{tab!=="people"&&<button onClick={()=>setFilters({tab:"people"})} className="text-xs font-semibold text-accent">See all people</button>}</div>{searchPeople.map(person=><PeopleCard key={person.id} item={person}/>)}</section>}
                  {matchedTags.length>0&&!tagMode&&<section className="border-b border-border py-4"><h2 className="text-sm font-bold">Matching tags</h2><TagChips tags={matchedTags} onSelect={value=>{setQuery(`#${value}`);setFilters({q:`#${value}`,tag:"",tab:tab==="people"?"all":tab})}}/></section>}
                  {tab!=="people"&&items.length>0&&<h2 className="border-b border-border py-4 text-sm font-bold">Posts and decks</h2>}
                  {featured&&<FeaturedCard item={featured} query={urlQ} />}
                  <div className="divide-y divide-border border-t border-border">
                    {list.map((item) => (
                      <ResultRow
                        key={`${item.type}:${item.id}`}
                        item={item}
                        query={urlQ}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-24 text-center">
                  <Search className="mx-auto h-8 w-8 text-text-muted" />
                  <h2 className="mt-4 text-xl font-semibold">
                    No results found
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    Try another search or choose a different topic.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <aside className="hidden w-[330px] shrink-0 xl:block">
          <div className="sticky top-5 space-y-4">
            <label className="flex h-12 items-center gap-3 rounded-xl border border-border bg-surface px-4">
              <Search className="h-4 w-4 text-text-secondary outline-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 80))}
                placeholder="Search Yoohoo"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-text-muted"
              />
            </label>
            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Popular topics</h2>
                <TrendingUp className="h-4 w-4 text-text-secondary" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.slice(0, 10).map((item) => (
                  <button
                    key={item.tag}
                    onClick={() => {setQuery(`#${item.tag}`);setFilters({q:`#${item.tag}`,tag:"",tab:tab==="people"?"all":tab})}}
                    className={`rounded-full border px-3 py-1.5 text-xs ${tagMode&&searchMeta?.tags?.includes(item.tag) ? "border-accent bg-action-primary text-on-action-primary" : "border-border text-text-secondary"}`}
                  >
                    #{item.tag}
                  </button>
                ))}
              </div>
            </section>
            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Learners to discover</h2>
                <Users className="h-4 w-4 text-text-secondary" />
              </div>
              <div className="mt-4 space-y-4">
                {people.length ? (
                  people.map((person, index) => (
                    <Link
                      key={person.id}
                      href={`/u/${person.slug}`}
                      className="group flex items-center gap-3"
                    >
                      <span className="w-4 text-xs text-text-secondary">
                        {index + 1}
                      </span>
                      <UserAvatar src={person.author.avatarUrl} name={person.author.displayName} size={36} textClassName="text-xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold group-hover:underline">
                          {person.author.displayName}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          @{person.author.username}
                        </span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <RailSkeleton />
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}

function FeaturedCard({ item, query }: { item: Item; query: string }) {
  const isDeck = item.type === "deck",
    href = `/${isDeck ? "d" : "p"}/${item.slug}`;
  return (
    <article className="py-5">
      <Link
        href={href}
        className="group block overflow-hidden rounded-2xl border border-border-strong bg-surface-subtle p-5"
      >
        <div className="rounded-xl border border-border bg-surface p-5">
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-text-secondary">
            {isDeck ? (
              <BookOpen className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Featured {isDeck ? "deck" : "post"}
          </span>
          <h1 className="mt-8 text-3xl font-bold leading-tight group-hover:text-accent">
            <Highlight text={item.title} query={query} />
          </h1>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-text-secondary">
            {item.summary ||
              "Discover something new from the Yoohoo learning community."}
          </p>
          <div className="mt-8 flex items-end justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <UserAvatar src={item.author.avatarUrl} name={item.author.displayName} size={28} textClassName="text-[10px]" />
              @{item.author.username}
            </span>
            {isDeck && (
              <span className="text-xs text-text-secondary">
                {item.completionCount} completions
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
function ResultRow({ item, query }: { item: Item; query: string }) {
  const isPeople = item.type === "people",
    isDeck = item.type === "deck",
    href = isPeople ? `/u/${item.slug}` : `/${isDeck ? "d" : "p"}/${item.slug}`;
  return (
    <article className="flex gap-4 py-5">
      <UserAvatar src={item.author.avatarUrl} name={item.author.displayName} size={40} textClassName="text-sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Link
            href={`/u/${item.author.username}`}
            className="font-semibold text-text hover:underline"
          >
            {item.author.displayName}
          </Link>
          <span>@{item.author.username}</span>
        </div>
        <Link href={href}>
          <h2 className="mt-2 text-lg font-semibold hover:text-accent">
            <Highlight text={item.title} query={query} />
          </h2>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">
          {item.summary}
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
          <span>{isPeople ? "Learner" : isDeck ? "Deck" : "Post"}</span>
          {isDeck && <span>{item.completionCount} completions</span>}
          {item.tags.slice(0, 2).map((value) => (
            <span key={value}>#{value}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
function TagChips({tags,onSelect}:{tags:Tag[];onSelect:(tag:string)=>void}){
  if(!tags.length)return null;
  return <div className="mt-3 flex flex-wrap justify-center gap-2">{tags.map(item=><button key={item.tag} type="button" onClick={()=>onSelect(item.tag)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary hover:border-accent hover:text-accent">Tag: #{item.tag} · {item.count}</button>)}</div>;
}
function PeopleCard({item}:{item:Item}){
  const {data:session}=useSession(),toast=useToast();
  const isOwner=session?.user?.id===item.id,[following,setFollowing]=useState(Boolean(item.followedByMe)),[busy,setBusy]=useState(false);
  async function toggle(){if(!session?.user||isOwner||busy)return;const previous=following;setFollowing(!previous);setBusy(true);try{const response=await fetch(`/api/follows/${item.id}`,{method:previous?"DELETE":"POST"}),data=await response.json();if(!response.ok)throw new Error(data.error||"Follow could not be updated.")}catch(error){setFollowing(previous);toast.error(error instanceof Error?error.message:"Follow could not be updated.")}finally{setBusy(false)}}
  return <article className="flex items-center gap-3 py-3"><Link href={`/u/${item.slug}`}><UserAvatar src={item.author.avatarUrl} name={item.author.displayName} size={44} textClassName="text-sm"/></Link><Link href={`/u/${item.slug}`} className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.author.displayName}</span><span className="block truncate text-xs text-text-muted">@{item.author.username}</span>{item.summary&&<span className="mt-1 block line-clamp-1 text-xs text-text-secondary">{item.summary}</span>}</Link>{session?.user&&!isOwner&&<button type="button" onClick={()=>void toggle()} disabled={busy} className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${following?"border border-accent bg-accent-subtle text-accent":"bg-action-primary text-on-action-primary"}`}>{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:following?"Following":"Follow"}</button>}</article>;
}
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const index = text
    .toLocaleLowerCase("en")
    .indexOf(query.toLocaleLowerCase("en"));
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-accent text-on-accent">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}
function ExploreSkeleton() {
  return (
    <div
      className="w-full min-w-0 py-5 xl:w-[720px] xl:min-w-[720px]"
      role="status"
    >
      <div className="h-80 w-full animate-pulse rounded-2xl bg-skeleton" />
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex gap-4 border-b border-border py-5">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-skeleton" />
          <div className="flex-1">
            <div className="h-3 w-40 animate-pulse rounded bg-skeleton" />
            <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-skeleton" />
            <div className="mt-3 h-4 w-full animate-pulse rounded bg-skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}
function RailSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-10 animate-pulse rounded-lg bg-skeleton" />
      <div className="h-10 animate-pulse rounded-lg bg-skeleton" />
      <div className="h-10 animate-pulse rounded-lg bg-skeleton" />
    </div>
  );
}
