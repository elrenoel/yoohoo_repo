import { ZodError } from "zod";
import { ragSql } from "@/lib/rag/db";
import { jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
import { publishDeckSchema } from "@/lib/public-deck-validation";
import { MIN_PUBLIC_CARDS, newDeckSlug, notify, replaceSnapshot } from "@/lib/public-decks";
import { postSlug } from "@/lib/post-validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const { id: deckId } = await params;
    const input = publishDeckSchema.parse(await jsonBody(request));
    const sql = ragSql();
    const result = await sql.begin(async tx => {
      const decks = await tx`select id from public.decks where id=${deckId} and user_id=${userId} and deleted_at is null for update`;
      if (!decks[0]) return { status: 404 as const };
      const counts = await tx<{ count: number }[]>`select count(distinct f.id)::int as count from public.flashcards f where f.deck_id=${deckId} or f.document_id in (select document_id from public.deck_documents where deck_id=${deckId})`;
      if ((counts[0]?.count ?? 0) < MIN_PUBLIC_CARDS) return { status: 422 as const };
      const profiles = await tx`select 1 from public.profiles where user_id=${userId}`;
      if (!profiles[0]) return { status: 428 as const };
      const existing = await tx`select id,slug,status from public.public_decks where source_deck_id=${deckId}`;
      if (existing[0]) return { status: 409 as const, deck: existing[0] };
      const slug = newDeckSlug(input.title);
      const rows = await tx`insert into public.public_decks(owner_id,source_deck_id,slug,title,description,tags,language)
        values(${userId},${deckId},${slug},${input.title},${input.description},${input.tags},${input.language}) returning id,slug,version,status`;
      await replaceSnapshot(tx, String(rows[0].id), deckId);
      if (input.caption) {
        const postPath=postSlug(input.caption);
        const posts=await tx`insert into public.posts(author_id,slug,title,excerpt,body,body_md,tags,embedded_public_deck_id,status,published_at)
          values(${userId},${postPath},${input.caption.slice(0,80)},${input.caption.slice(0,300)},${input.caption},${input.caption},${input.tags.slice(0,3)},${rows[0].id},'published',now()) returning id`;
        await notify(tx,userId,"post_published","Post dipublikasikan","Caption deck kamu sudah tampil di feed.",`/p/${postPath}`,userId,"post",String(posts[0].id));
      }
      await notify(tx,userId,"deck_published","Deck dipublikasikan",`Deck “${input.title}” sekarang dapat dilihat publik.`,`/d/${slug}`);
      return { status: 201 as const, deck: rows[0] };
    });
    if (result.status === 404) return Response.json({error:"Deck tidak ditemukan."},{status:404});
    if (result.status === 422) return Response.json({error:`Deck membutuhkan minimal ${MIN_PUBLIC_CARDS} flashcard untuk dipublikasikan.`},{status:422});
    if (result.status === 428) return Response.json({error:"Buat username publik terlebih dahulu sebelum mempublikasikan deck.",onboarding:"/onboarding/username"},{status:428});
    if (result.status === 409) return Response.json({error:"Deck ini sudah memiliki snapshot publik.",publicDeck:result.deck},{status:409});
    return Response.json({publicDeck:result.deck},{status:201});
  } catch(error) { if(error instanceof ZodError) return Response.json({error:error.issues[0]?.message},{status:400}); return ragResponseError(error); }
}
