import dotenv from "dotenv";
import postgres from "postgres";
import {
  generateRepresentativeQuiz,
  representativeQuizCount,
} from "../src/lib/rag/materials";

dotenv.config({ path: ".env.local" });

const deckArgIndex = process.argv.indexOf("--deck-id");
const deckId = deckArgIndex >= 0 ? process.argv[deckArgIndex + 1] : "";
if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(deckId)) {
  throw new Error("Gunakan --deck-id <uuid>.");
}
if (!process.env.SUPABASE_DATABASE_URL) throw new Error("SUPABASE_DATABASE_URL belum diatur.");

const sql = postgres(process.env.SUPABASE_DATABASE_URL, {
  prepare: false,
  max: 1,
  connect_timeout: 20,
  ssl: "require",
});

async function main() {
try {
  const documents = await sql`
    select d.id,d.title,d.content_language
    from public.deck_documents dd
    join public.documents d on d.id=dd.document_id
    where dd.deck_id=${deckId} and d.deleted_at is null
      and exists (select 1 from public.flashcards f where f.document_id=d.id and f.deck_id=${deckId})
      and not exists (select 1 from public.quiz_sets qs where qs.document_id=d.id)
    order by dd.added_at`;

  for (const document of documents) {
    const cards = await sql`
      select term,definition from public.flashcards
      where document_id=${document.id} and deck_id=${deckId}
      order by id`;
    const questions = await generateRepresentativeQuiz(
      cards.map(card => ({ term: String(card.term), definition: String(card.definition) })),
      representativeQuizCount(cards.length),
      String(document.content_language ?? "auto"),
    );

    await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${document.id}, 0))`;
      const [existing] = await tx`select id from public.quiz_sets where document_id=${document.id} limit 1`;
      if (existing) return;
      const [quizSet] = await tx`
        insert into public.quiz_sets (document_id,label)
        values (${document.id},'Set 1') returning id`;
      for (const question of questions) {
        await tx`insert into public.quiz_questions
          (document_id,quiz_set_id,question,options,correct_index,explanation,difficulty)
          values (${document.id},${quizSet.id},${question.question},${tx.json(question.options)},
            ${question.correct_index},${question.explanation},${question.difficulty})`;
      }
    });
    console.log(`OK ${document.title}: ${questions.length} soal`);
  }

  console.log(`Selesai: ${documents.length} materi dipulihkan.`);
} finally {
  await sql.end();
}
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
