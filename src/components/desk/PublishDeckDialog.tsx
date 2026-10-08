"use client";

import { useMemo, useState } from "react";
import { Copy, LoaderCircle, X } from "lucide-react";
import { useToast } from "@/lib/toast";

type Visibility = "private" | "unlisted" | "public";
type Deck = { id:string; title:string; visibility?:Visibility; slug?:string|null };
const choices: Array<{value:Visibility;label:string;help:string}> = [
  {value:"private",label:"Private",help:"Only me"},
  {value:"unlisted",label:"Anyone with the link",help:"Hidden from Explore and your profile"},
  {value:"public",label:"Public",help:"Visible in Explore and on your profile"},
];

export default function PublishDeckDialog({deck,onClose,onDone}:{deck:Deck;onClose:()=>void;onDone:()=>void}) {
  const toast=useToast(),[visibility,setVisibility]=useState<Visibility>(deck.visibility??"private"),[slug,setSlug]=useState(deck.slug??null),[busy,setBusy]=useState(false);
  const link=useMemo(()=>slug&&typeof window!=="undefined"?`${window.location.origin}/desk/${deck.id}?share=1`:"",[slug,deck.id]);
  async function save(){setBusy(true);const id=toast.loading("Saving sharing settings…");try{const response=await fetch(`/api/decks/${deck.id}/share`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({visibility})}),body=await response.json();if(!response.ok)throw new Error(body.error||"Could not save sharing settings.");setSlug(body.deck.slug);toast.success(visibility==="private"?"Deck is private again.":visibility==="public"?"Deck is now public.":"Deck link is ready to share.",{id});onDone();onClose()}catch(error){toast.error(error instanceof Error?error.message:"Could not save sharing settings.",{id})}finally{setBusy(false)}}
  async function copy(){if(!link)return;try{await navigator.clipboard.writeText(link);toast.success("Deck link copied.")}catch{toast.error("Could not copy the link.")}}
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-5"><div className="w-full max-w-lg border border-[#D8DCD3] bg-[#F5F6F3] p-6"><div className="flex justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#C24A3D]">Share deck</p><h2 className="mt-1 font-serif text-2xl font-semibold">{deck.title}</h2></div><button type="button" onClick={onClose} aria-label="Close"><X/></button></div><div className="my-5 border-l-2 border-[#C24A3D] bg-white p-4 text-sm leading-6 text-[#5B6B62]">Only flashcards and quiz questions are shared. PDFs, source text, and RAG chunks remain private.</div><div className="space-y-2">{choices.map(choice=><label key={choice.value} className={`flex cursor-pointer gap-3 border p-4 ${visibility===choice.value?"border-[#164C3D] bg-[#EEF5F0]":"border-[#D8DCD3] bg-white"}`}><input type="radio" name="visibility" value={choice.value} checked={visibility===choice.value} onChange={()=>setVisibility(choice.value)}/><span><strong className="block">{choice.label}</strong><span className="text-xs text-[#5B6B62]">{choice.help}</span></span></label>)}</div>{visibility!=="private"&&slug&&<div className="mt-5"><label className="font-mono text-xs">Share link</label><div className="mt-1 flex"><input readOnly value={link} className="min-w-0 flex-1 border border-[#D8DCD3] bg-white px-3 py-2.5 text-sm"/><button type="button" onClick={()=>void copy()} className="flex items-center gap-2 bg-[#16241D] px-4 text-sm text-white"><Copy className="h-4 w-4"/>Copy</button></div></div>}<button type="button" onClick={()=>void save()} disabled={busy} className="mt-6 flex w-full justify-center gap-2 bg-[#164C3D] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy&&<LoaderCircle className="h-5 w-5 animate-spin"/>}Save</button></div></div>;
}
