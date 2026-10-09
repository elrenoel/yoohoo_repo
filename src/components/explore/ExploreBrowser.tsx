"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, FileText, LoaderCircle, Search, TrendingUp, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/lib/toast";

type Tab = "all" | "deck" | "post" | "people";
type Sort = "newest" | "popular" | "proven";
type Item = { id:string; type:"deck"|"post"|"people"; slug:string; title:string; summary:string; tags:string[]; publishedAt:string; author:{username:string;displayName:string;avatarUrl:string|null}; completionCount:number; averageScore:number|null; popularity:number };
type Tag = { tag:string; count:number };
type ExplorePage = { items:Item[]; nextCursor:string|null };
const tabs:{value:Tab;label:string}[] = [{value:"all",label:"Explore"},{value:"deck",label:"Decks"},{value:"post",label:"Posts"},{value:"people",label:"People"}];

export default function ExploreBrowser() {
  const searchParams=useSearchParams(), router=useRouter(), pathname=usePathname(), toast=useToast();
  const urlQ=searchParams.get("q")||"", tab=(searchParams.get("tab")||"all") as Tab, tag=searchParams.get("tag")||"", sort=(searchParams.get("sort")||"newest") as Sort;
  const [query,setQuery]=useState(urlQ); const sentinel=useRef<HTMLDivElement>(null);
  const filters=useMemo(()=>({q:urlQ,tab,tag,sort}),[urlQ,tab,tag,sort]);
  const setFilters=useCallback((patch:Record<string,string>)=>{const next=new URLSearchParams(searchParams.toString());for(const [key,value] of Object.entries(patch)){if(value&&value!=="all"&&!(key==="sort"&&value==="newest"))next.set(key,value);else next.delete(key)}const suffix=next.toString();router.push(`${pathname}${suffix?`?${suffix}`:""}`,{scroll:false})},[pathname,router,searchParams]);
  useEffect(()=>{if(query===urlQ)return;const timer=window.setTimeout(()=>setFilters({q:query.trim()}),350);return()=>window.clearTimeout(timer)},[query,urlQ,setFilters]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>setQuery(urlQ),[urlQ]);
  const explore=useInfiniteQuery({queryKey:queryKeys.explore(filters),initialPageParam:null as string|null,queryFn:async({pageParam})=>{const params=new URLSearchParams(filters);if(pageParam)params.set("cursor",pageParam);const response=await fetch(`/api/explore?${params}`),data=await response.json();if(!response.ok)throw new Error(data.error||"Explore could not be loaded.");return data as ExplorePage},getNextPageParam:last=>last.nextCursor??undefined,staleTime:5*60_000,gcTime:30*60_000,placeholderData:keepPreviousData});
  const tagQuery=useQuery({queryKey:queryKeys.exploreTags,queryFn:async()=>{const response=await fetch("/api/explore/tags");if(!response.ok)throw new Error("Topics could not be loaded.");return response.json() as Promise<{tags:Tag[]}>},staleTime:30*60_000,gcTime:24*60*60_000});
  const items=useMemo(()=>[...new Map((explore.data?.pages.flatMap(page=>page.items)??[]).map(item=>[`${item.type}:${item.id}`,item])).values()],[explore.data]);
  const tags=tagQuery.data?.tags??[], people=items.filter(item=>item.type==="people").slice(0,5), featured=items.find(item=>item.type!=="people");
  const list=featured?items.filter(item=>`${item.type}:${item.id}`!==`${featured.type}:${featured.id}`):items;
  const {fetchNextPage,hasNextPage,isFetchingNextPage}=explore;
  useEffect(()=>{if(explore.error)toast.error(explore.error.message)},[explore.error,toast]);
  useEffect(()=>{const node=sentinel.current;if(!node||!hasNextPage)return;const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting&&!isFetchingNextPage)void fetchNextPage()},{rootMargin:"300px"});observer.observe(node);return()=>observer.disconnect()},[fetchNextPage,hasNextPage,isFetchingNextPage]);

  return <main className="min-h-screen bg-bg text-text"><div className="flex w-full gap-8 px-8 pb-24 pt-5">
    <div className="min-w-0 flex-1"><div className="mx-auto w-full max-w-[900px]">
      <nav className="flex gap-2 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(item=><button key={item.value} onClick={()=>setFilters({tab:item.value})} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${tab===item.value?"bg-action-primary text-on-action-primary":"bg-surface-subtle text-text-secondary hover:bg-surface-hover"}`}>{item.label}</button>)}
        {tags.slice(0,12).map(item=><button key={item.tag} onClick={()=>setFilters({tag:tag===item.tag?"":item.tag})} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${tag===item.tag?"bg-action-primary text-on-action-primary":"bg-surface-subtle text-text-secondary"}`}>{item.tag}</button>)}
      </nav>
      <div className="mx-auto w-full max-w-[720px] xl:min-w-[720px]">
        <div className="mb-2 flex items-center justify-between border-b border-border py-3"><p className="text-sm font-semibold">{tag?`#${tag}`:urlQ?`Results for “${urlQ}”`:"Discover what to learn next"}</p><select value={sort} onChange={event=>setFilters({sort:event.target.value})} className="bg-transparent text-xs text-text-secondary outline-none" aria-label="Sort results"><option value="newest">Newest</option><option value="popular">Popular</option><option value="proven" disabled={tab==="post"||tab==="people"}>Proven</option></select></div>
        {explore.isPending?<ExploreSkeleton/>:featured?<><FeaturedCard item={featured} query={urlQ}/><div className="divide-y divide-border border-t border-border">{list.map(item=><ResultRow key={`${item.type}:${item.id}`} item={item} query={urlQ}/>)}</div></>:<div className="py-24 text-center"><Search className="mx-auto h-8 w-8 text-text-muted"/><h2 className="mt-4 text-xl font-semibold">No results found</h2><p className="mt-2 text-sm text-text-secondary">Try another search or choose a different topic.</p></div>}
        <div ref={sentinel} className="py-8 text-center">{isFetchingNextPage&&<LoaderCircle className="mx-auto h-5 w-5 animate-spin"/>}</div>
      </div>
    </div></div>
    <aside className="hidden w-[330px] shrink-0 xl:block"><div className="sticky top-5 space-y-4">
      <label className="flex h-12 items-center gap-3 rounded-xl border border-border bg-surface px-4"><Search className="h-4 w-4 text-text-secondary"/><input value={query} onChange={event=>setQuery(event.target.value.slice(0,80))} placeholder="Search Yoohoo" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"/>{query!==urlQ&&<LoaderCircle className="h-4 w-4 animate-spin"/>}</label>
      <section className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Popular topics</h2><TrendingUp className="h-4 w-4 text-text-secondary"/></div><div className="mt-4 flex flex-wrap gap-2">{tags.slice(0,10).map(item=><button key={item.tag} onClick={()=>setFilters({tag:tag===item.tag?"":item.tag})} className={`rounded-full border px-3 py-1.5 text-xs ${tag===item.tag?"border-accent bg-action-primary text-on-action-primary":"border-border text-text-secondary"}`}>#{item.tag}</button>)}</div></section>
      <section className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Learners to discover</h2><Users className="h-4 w-4 text-text-secondary"/></div><div className="mt-4 space-y-4">{people.length?people.map((person,index)=><Link key={person.id} href={`/u/${person.slug}`} className="group flex items-center gap-3"><span className="w-4 text-xs text-text-secondary">{index+1}</span><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-sm font-bold text-accent">{person.author.displayName.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold group-hover:underline">{person.author.displayName}</span><span className="block truncate text-xs text-text-muted">@{person.author.username}</span></span></Link>):<RailSkeleton/>}</div></section>
    </div></aside>
  </div></main>;
}

function FeaturedCard({item,query}:{item:Item;query:string}){const isDeck=item.type==="deck",href=`/${isDeck?"d":"p"}/${item.slug}`;return <article className="py-5"><Link href={href} className="group block overflow-hidden rounded-2xl border border-border-strong bg-surface-subtle p-5"><div className="rounded-xl border border-border bg-surface p-5"><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-text-secondary">{isDeck?<BookOpen className="h-4 w-4"/>:<FileText className="h-4 w-4"/>}Featured {isDeck?"deck":"post"}</span><h1 className="mt-8 text-3xl font-bold leading-tight group-hover:text-accent"><Highlight text={item.title} query={query}/></h1><p className="mt-3 line-clamp-3 text-sm leading-6 text-text-secondary">{item.summary||"Discover something new from the Yoohoo learning community."}</p><div className="mt-8 flex items-end justify-between gap-4"><span className="text-sm font-semibold">@{item.author.username}</span>{isDeck&&<span className="text-xs text-text-secondary">{item.completionCount} completions</span>}</div></div></Link></article>}
function ResultRow({item,query}:{item:Item;query:string}){const isPeople=item.type==="people",isDeck=item.type==="deck",href=isPeople?`/u/${item.slug}`:`/${isDeck?"d":"p"}/${item.slug}`;return <article className="flex gap-4 py-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-subtle font-bold text-accent">{item.author.displayName.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-xs text-text-muted"><Link href={`/u/${item.author.username}`} className="font-semibold text-text hover:underline">{item.author.displayName}</Link><span>@{item.author.username}</span></div><Link href={href}><h2 className="mt-2 text-lg font-semibold hover:text-accent"><Highlight text={item.title} query={query}/></h2></Link><p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">{item.summary}</p><div className="mt-3 flex items-center gap-3 text-xs text-text-muted"><span>{isPeople?"Learner":isDeck?"Deck":"Post"}</span>{isDeck&&<span>{item.completionCount} completions</span>}{item.tags.slice(0,2).map(value=><span key={value}>#{value}</span>)}</div></div></article>}
function Highlight({text,query}:{text:string;query:string}){if(!query)return <>{text}</>;const index=text.toLocaleLowerCase("en").indexOf(query.toLocaleLowerCase("en"));if(index<0)return <>{text}</>;return <>{text.slice(0,index)}<mark className="bg-accent text-on-accent">{text.slice(index,index+query.length)}</mark>{text.slice(index+query.length)}</>}
function ExploreSkeleton(){return <div className="w-full min-w-0 py-5 xl:w-[720px] xl:min-w-[720px]" role="status"><div className="h-80 w-full animate-pulse rounded-2xl bg-skeleton"/>{[1,2,3].map(item=><div key={item} className="flex gap-4 border-b border-border py-5"><div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-skeleton"/><div className="flex-1"><div className="h-3 w-40 animate-pulse rounded bg-skeleton"/><div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-skeleton"/><div className="mt-3 h-4 w-full animate-pulse rounded bg-skeleton"/></div></div>)}</div>}
function RailSkeleton(){return <div className="space-y-3"><div className="h-10 animate-pulse rounded-lg bg-skeleton"/><div className="h-10 animate-pulse rounded-lg bg-skeleton"/><div className="h-10 animate-pulse rounded-lg bg-skeleton"/></div>}
