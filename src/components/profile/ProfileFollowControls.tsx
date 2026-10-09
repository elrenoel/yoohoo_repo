"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { useToast } from "@/lib/toast";

type Person = { userId:string; username:string; displayName:string; avatarUrl:string|null };

export default function ProfileFollowControls({ targetUserId, username, isOwner, initialFollowing, initialFollowers, initialFollowingCount }: { targetUserId:string; username:string; isOwner:boolean; initialFollowing:boolean; initialFollowers:number; initialFollowingCount:number }) {
  const toast=useToast();
  const [following,setFollowing]=useState(initialFollowing),[followers,setFollowers]=useState(initialFollowers),[busy,setBusy]=useState(false);
  const [list,setList]=useState<"followers"|"following"|null>(null),[people,setPeople]=useState<Person[]>([]),[loading,setLoading]=useState(false);
  async function toggle(){if(busy||isOwner)return;const previous=following;setFollowing(!previous);setFollowers(value=>Math.max(0,value+(previous?-1:1)));setBusy(true);try{const response=await fetch(`/api/follows/${targetUserId}`,{method:previous?"DELETE":"POST"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Follow could not be updated.")}catch(error){setFollowing(previous);setFollowers(value=>Math.max(0,value+(previous?1:-1)));toast.error(error instanceof Error?error.message:"Follow could not be updated.")}finally{setBusy(false)}}
  function open(next:"followers"|"following"){setPeople([]);setLoading(true);setList(next)}
  useEffect(()=>{if(!list)return;let active=true;void fetch(`/api/users/${encodeURIComponent(username)}/${list}`).then(response=>response.json()).then(data=>{if(active)setPeople(data.items||[])}).catch(()=>{if(active)toast.error("The list could not be loaded.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[list,toast,username]);
  return <>
    <div className="mt-7 flex items-center gap-5 text-sm text-text-secondary">
      <button onClick={()=>open("followers")} className="hover:text-text hover:underline"><strong className="text-text">{followers}</strong> followers</button>
      <button onClick={()=>open("following")} className="hover:text-text hover:underline"><strong className="text-text">{initialFollowingCount}</strong> following</button>
    </div>
    {!isOwner&&<button onClick={()=>void toggle()} disabled={busy} className={`mt-5 h-11 w-full rounded-lg text-sm font-bold transition ${following?"border border-accent bg-accent-subtle text-accent":"bg-action-primary text-on-action-primary hover:bg-action-primary-hover"}`}>{busy?<LoaderCircle className="mx-auto h-4 w-4 animate-spin"/>:following?"Following":"Follow"}</button>}
    {list&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-overlay sm:items-center sm:p-5"><section className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface-raised p-6"><header className="flex items-center justify-between"><h2 className="text-xl font-bold">{list==="followers"?"Followers":"Following"}</h2><button onClick={()=>setList(null)} className="rounded-full p-2 hover:bg-surface-hover"><X className="h-5 w-5"/></button></header><div className="mt-5 divide-y divide-border">{loading?<LoaderCircle className="mx-auto my-10 animate-spin"/>:people.length?people.map(person=><Link key={person.userId} href={`/u/${person.username}`} onClick={()=>setList(null)} className="flex items-center gap-3 py-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-subtle font-bold text-accent">{person.displayName.slice(0,1).toUpperCase()}</span><span><span className="block text-sm font-semibold">{person.displayName}</span><span className="block text-xs text-text-secondary">@{person.username}</span></span></Link>):<p className="py-10 text-center text-sm text-text-secondary">No one here yet.</p>}</div></section></div>}
  </>;
}
