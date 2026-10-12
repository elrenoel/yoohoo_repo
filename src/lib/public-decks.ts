import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { slugBase } from "@/lib/public-deck-validation";

export const MIN_PUBLIC_CARDS = 3;

export function newDeckSlug(title: string) {
  return `${slugBase(title)}-${randomBytes(3).toString("hex")}`;
}

export async function replaceSnapshot(tx: postgres.TransactionSql, publicDeckId: string, sourceDeckId: string) {
  await tx`delete from public.public_deck_cards where public_deck_id=${publicDeckId}`;
  await tx`delete from public.public_deck_questions where public_deck_id=${publicDeckId}`;
  const [schema] = await tx<{ hasBlobVariant: boolean }[]>`
    select exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='flashcards'
        and column_name='blob_variant'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='public_deck_cards'
        and column_name='blob_variant'
    ) as "hasBlobVariant"`;
  if (schema?.hasBlobVariant) {
    await tx`
      insert into public.public_deck_cards(
        public_deck_id, position, front, back, content_type, blob_variant
      )
      select ${publicDeckId}, row_number() over(order by f.id)::int,
        f.term, f.definition, 'concept', f.blob_variant
      from public.flashcards f
      where f.deck_id=${sourceDeckId} or f.document_id in (
        select document_id from public.deck_documents where deck_id=${sourceDeckId}
      )
      order by f.id`;
  } else {
    await tx`
      insert into public.public_deck_cards(public_deck_id, position, front, back, content_type)
      select ${publicDeckId}, row_number() over(order by f.id)::int, f.term, f.definition, 'concept'
      from public.flashcards f
      where f.deck_id=${sourceDeckId} or f.document_id in (
        select document_id from public.deck_documents where deck_id=${sourceDeckId}
      )
      order by f.id`;
  }
  await tx`
    insert into public.public_deck_questions(public_deck_id, position, question, options, correct_index, explanation, difficulty)
    select ${publicDeckId}, row_number() over(order by qs.created_at, q.id)::int,
      q.question, q.options, q.correct_index, q.explanation, q.difficulty
    from public.quiz_questions q
    join public.quiz_sets qs on qs.id=q.quiz_set_id
    where (q.document_id in (select document_id from public.deck_documents where deck_id=${sourceDeckId}) or qs.group_id in (select id from public.flashcard_groups where deck_id=${sourceDeckId}))
      and (qs.id in (
        select distinct on (document_id) id from public.quiz_sets
        where document_id in (select document_id from public.deck_documents where deck_id=${sourceDeckId})
        order by document_id, created_at desc
      ) or qs.id in (
        select distinct on (group_id) id from public.quiz_sets
        where group_id in (select id from public.flashcard_groups where deck_id=${sourceDeckId})
        order by group_id,created_at desc
      ))
    order by qs.created_at, q.id
  `;
}

export async function notify(tx: postgres.TransactionSql, userId: string, type: string, title: string, body: string, link: string, actorId?: string, targetType?: string, targetId?: string) {
  await tx`insert into public.notifications(user_id,type,severity,title,body,link,actor_id,target_type,target_id,dedupe_key)
    values(${userId},${type},'success',${title},${body},${link},${actorId??null},${targetType??null},${targetId??null},${`${type}:${randomUUID()}`})`;
}
