import { ragSql } from "@/lib/rag/db";
import { ragResponseError, sessionUser } from "@/lib/rag/http";
import { MIN_PUBLIC_CARDS, notify, replaceSnapshot } from "@/lib/public-decks";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 try { const userId=await sessionUser(request); const {id}=await params; const sql=ragSql();
  const result=await sql.begin(async tx=>{ const rows=await tx`select id,source_deck_id,slug,title from public.public_decks where id=${id} and owner_id=${userId} for update`; const deck=rows[0]; if(!deck?.source_deck_id)return null;
   const count=await tx<{count:number}[]>`select count(distinct f.id)::int count from public.flashcards f where f.deck_id=${deck.source_deck_id} or f.document_id in(select document_id from public.deck_documents where deck_id=${deck.source_deck_id})`; if((count[0]?.count??0)<MIN_PUBLIC_CARDS)return {tooSmall:true};
   await replaceSnapshot(tx,id,String(deck.source_deck_id)); const updated=await tx`update public.public_decks set version=version+1,status='published',published_at=case when status='unpublished' then now() else published_at end where id=${id} returning id,slug,version,status`;
   await notify(tx,userId,"deck_snapshot_refreshed","Snapshot deck diperbarui",`Snapshot “${deck.title}” diperbarui ke versi ${updated[0].version}.`,`/d/${deck.slug}`); return {deck:updated[0]}; });
  if(!result)return Response.json({error:"Deck publik tidak ditemukan atau bukan milikmu."},{status:404}); if("tooSmall" in result)return Response.json({error:`Minimal ${MIN_PUBLIC_CARDS} flashcard diperlukan.`},{status:422}); return Response.json({publicDeck:result.deck});
 } catch(error){return ragResponseError(error)}
}
