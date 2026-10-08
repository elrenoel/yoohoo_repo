import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ragSql } from "@/lib/rag/db";

async function publicMeta(slug:string){
  const rows=await ragSql()`select pd.title,pd.description,coalesce(d.visibility,'public') visibility
    from public.public_decks pd left join public.decks d on d.id=pd.source_deck_id
    where pd.slug=${slug} and pd.status='published'
      and (pd.source_deck_id is null or (d.visibility in ('public','unlisted') and d.deleted_at is null)) limit 1`;
  return rows[0]??null;
}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params,deck=await publicMeta(slug);if(!deck)return{};
  const description=deck.visibility==="unlisted"?"Deck belajar bersama di Yoohoo.":String(deck.description||"Deck belajar bersama di Yoohoo.");
  return{title:`${deck.title} | Yoohoo`,description,robots:deck.visibility==="unlisted"?{index:false,follow:false}:undefined,openGraph:{title:String(deck.title),description,type:"article"}};
}
export default async function PublicDeckPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const rows=await ragSql()`select source_deck_id from public.public_decks where slug=${slug} and status='published' limit 1`;
  const sourceDeckId=rows[0]?.source_deck_id;
  if(!sourceDeckId)notFound();
  redirect(`/desk/${sourceDeckId}?share=1`);
}
