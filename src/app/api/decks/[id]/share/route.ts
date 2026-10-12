import { ZodError } from "zod";
import { ragSql } from "@/lib/rag/db";
import { jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
import { newShareSlug, shareDeckSchema } from "@/lib/deck-sharing";
import { canEditDeck } from "@/lib/deck-access";
import { MIN_PUBLIC_CARDS, notify, replaceSnapshot } from "@/lib/public-decks";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const { id } = await params;
    const { visibility } = shareDeckSchema.parse(await jsonBody(request));
    const candidateSlug = newShareSlug();
    const result = await ragSql().begin(async tx => {
      const rows = await tx`select id,user_id,title,visibility,slug,deleted_at from public.decks
        where id=${id} for update`;
      const deck = rows[0];
      if (!deck || deck.deleted_at || !canEditDeck({user_id:String(deck.user_id)},userId)) return { status: 404 as const };
      if (visibility !== "private") {
        const profiles = await tx`select 1 from public.profiles where user_id=${userId}`;
        if (!profiles[0]) return { status: 428 as const };
        const counts = await tx<{count:number}[]>`select count(distinct f.id)::int count from public.flashcards f
          where f.deck_id=${id} or f.document_id in (select document_id from public.deck_documents where deck_id=${id})`;
        if ((counts[0]?.count ?? 0) < MIN_PUBLIC_CARDS) return { status: 422 as const };
      }
      const slug = deck.slug ?? candidateSlug;
      await tx`update public.decks set visibility=${visibility},slug=${slug},
        shared_at=case when ${visibility}='private' then shared_at else now() end,updated_at=now()
        where id=${id}`;
      const snapshots = await tx`select id from public.public_decks where source_deck_id=${id} for update`;
      let snapshotId = snapshots[0]?.id as string | undefined;
      if (visibility === "private") {
        if (snapshotId) await tx`update public.public_decks set status='unpublished' where id=${snapshotId}`;
      } else if (snapshotId) {
        await replaceSnapshot(tx, snapshotId, id);
        await tx`update public.public_decks set slug=${slug},title=${deck.title},status='published',
          version=version+1,published_at=case when status='unpublished' then now() else published_at end where id=${snapshotId}`;
      } else {
        const created = await tx`insert into public.public_decks(owner_id,source_deck_id,slug,title,status)
          values(${userId},${id},${slug},${deck.title},'published') returning id`;
        snapshotId = String(created[0].id);
        await replaceSnapshot(tx, snapshotId, id);
      }
      const message = visibility === "private"
        ? `Deck “${deck.title}” is private again.`
        : visibility === "public" ? `Deck “${deck.title}” is now public.` : `Deck “${deck.title}” is now accessible by link.`;
      await notify(tx,userId,"deck_visibility_changed",visibility === "private" ? "Deck is private" : "Deck shared",message,visibility === "private" ? "/desk" : `/desk/${id}?share=1`);
      return { status: 200 as const, deck: { id, visibility, slug, sharedAt: visibility === "private" ? null : new Date().toISOString(), publicDeckId: snapshotId } };
    });
    if (result.status === 404) return Response.json({error:"Deck not found."},{status:404});
    if (result.status === 428) return Response.json({error:"Create a public username first.",onboarding:"/onboarding/username"},{status:428});
    if (result.status === 422) return Response.json({error:`A deck needs at least ${MIN_PUBLIC_CARDS} flashcards before it can be shared.`},{status:422});
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) return Response.json({error:"Invalid visibility."},{status:400});
    return ragResponseError(error);
  }
}
