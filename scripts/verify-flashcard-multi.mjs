// Verifikasi flashcard_multi_document_items (jalankan: node scripts/verify-flashcard-multi.mjs)
import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DATABASE_URL="(.+)"$/m)?.[1];
if (!url) throw new Error("SUPABASE_DATABASE_URL tidak ditemukan di .env.local");
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, ssl: "require" });

const TEST_USER = "verify-flashcard-multi-user";
const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
};

try {
  // Siapkan user uji (decks.user_id & documents.user_id FK ke tabel "user")
  const [existingUser] = await sql`select id from public."user" where id=${TEST_USER}`;
  if (!existingUser) {
    await sql`insert into public."user" (id, name, email, email_verified)
      values (${TEST_USER}, 'Verify Multi Doc', 'verify-multi-doc@example.com', false)`;
  }
  // Siapkan data uji: deck + document + 2 keyword + relasi
  const [deck] = await sql`insert into public.decks (user_id, title) values (${TEST_USER}, 'VERIFY-MULTI-DOC') returning id`;
  const [doc] = await sql`insert into public.documents (user_id, title, raw_text, status) values (${TEST_USER}, 'VERIFY-MULTI-DOC', 'isi uji', 'ready_for_selection') returning id`;
  await sql`insert into public.deck_documents (deck_id, document_id) values (${deck.id}, ${doc.id})`;
  const [kw1] = await sql`insert into public.candidate_keywords (document_id, term, snippet) values (${doc.id}, 'verify-term-1', 'snippet uji yang cukup panjang untuk lolos validasi') returning id`;
  const [kw2] = await sql`insert into public.candidate_keywords (document_id, term, snippet) values (${doc.id}, 'verify-term-2', 'snippet uji yang cukup panjang untuk lolos validasi') returning id`;

  // 1. Insert job uji -> 1 notifikasi queued (trigger INSERT)
  const idem = "verify-" + Date.now();
  const [job] = await sql`
    insert into public.generation_jobs
      (id, user_id, kind, status, deck_id, document_id, idempotency_key, selected_keyword_ids, expected_items, quota_count, remaining_quota)
    values (gen_random_uuid(), ${TEST_USER}, 'flashcard_generate', 'queued', ${deck.id}, ${doc.id}, ${idem}, array[${kw1.id}]::uuid[], 1, 1, 4)
    returning id`;
  let [n1] = await sql`select count(*)::int as c from public.notifications where job_id=${job.id}`;
  ok("notifikasi queued setelah INSERT job", n1.c === 1, `count=${n1.c}`);

  // 2. Insert items: keyword harus bisa di-insert dua-duanya
  await sql`insert into public.generation_job_items (job_id, document_id, keyword_id, batch_index) values (${job.id}, ${doc.id}, ${kw1.id}, 1)`;
  await sql`insert into public.generation_job_items (job_id, document_id, keyword_id, batch_index) values (${job.id}, ${doc.id}, ${kw2.id}, 2)`;
  ok("insert 2 items (job, dokumen, keyword) sukses", true);

  // 3. Duplikat keyword per job harus DITOLAK
  let dupRejected = false;
  try {
    await sql`insert into public.generation_job_items (job_id, document_id, keyword_id, batch_index) values (${job.id}, ${doc.id}, ${kw1.id}, 3)`;
  } catch (e) {
    dupRejected = e.code === "23505";
  }
  ok("duplikat (job_id, keyword_id) ditolak unique violation", dupRejected);

  // 4. Status transitions -> notifikasi running & succeeded, tanpa duplikat
  await sql`update public.generation_jobs set status='running' where id=${job.id}`;
  await sql`update public.generation_jobs set status='succeeded' where id=${job.id}`;
  // Update lagi ke status sama -> tidak menambah notifikasi (dedupe)
  await sql`update public.generation_jobs set status='succeeded', flashcard_count=1 where id=${job.id}`;
  const [n2] = await sql`select count(*)::int as c from public.notifications where job_id=${job.id}`;
  ok("total 3 notifikasi (queued/running/succeeded), tanpa duplikat", n2.c === 3, `count=${n2.c}`);

  // 5. Idempotency: insert dengan (user_id, idempotency_key) sama harus dipetakan ke job yang sama
  const [job2] = await sql`
    insert into public.generation_jobs
      (id, user_id, kind, status, deck_id, document_id, idempotency_key, selected_keyword_ids, expected_items, quota_count, remaining_quota)
    values (gen_random_uuid(), ${TEST_USER}, 'flashcard_generate', 'queued', ${deck.id}, ${doc.id}, ${idem}, array[${kw1.id}]::uuid[], 1, 1, 4)
    on conflict (user_id, idempotency_key) do update set status = excluded.status
    returning id`;
  ok("idempotency: key sama menghasilkan job yang sama", job2.id === job.id, `${job2.id} vs ${job.id}`);

  // 6. flashcards: unique (deck_id, keyword_id) menolak duplikat
  await sql`insert into public.flashcards (document_id, deck_id, keyword_id, term, definition) values (${doc.id}, ${deck.id}, ${kw1.id}, 'Verify term 1', 'Definisi uji')`;
  let fcDupRejected = false;
  try {
    await sql`insert into public.flashcards (document_id, deck_id, keyword_id, term, definition) values (${doc.id}, ${deck.id}, ${kw1.id}, 'Verify term 1b', 'Definisi uji 2')`;
  } catch (e) {
    fcDupRejected = e.code === "23505";
  }
  ok("flashcards duplikat (deck_id, keyword_id) ditolak", fcDupRejected);

  // 7. generation_jobs.document_id nullable terbukti: job tanpa document_id
  const [job3] = await sql`
    insert into public.generation_jobs
      (id, user_id, kind, status, deck_id, idempotency_key, selected_keyword_ids, expected_items, quota_count, remaining_quota)
    values (gen_random_uuid(), ${TEST_USER}, 'flashcard_generate', 'queued', ${deck.id}, ${idem + "-nodoc"}, array[${kw1.id}]::uuid[], 1, 1, 4)
    returning id`;
  ok("generation_jobs.document_id nullable (job multi-dokumen)", Boolean(job3.id));

  // === CLEANUP data uji ===
  await sql`delete from public.notifications where user_id=${TEST_USER}`;
  await sql`delete from public.generation_jobs where user_id=${TEST_USER}`;
  await sql`delete from public.generation_job_items where document_id=${doc.id}`;
  await sql`delete from public.flashcards where document_id=${doc.id}`;
  await sql`delete from public.candidate_keywords where document_id=${doc.id}`;
  await sql`delete from public.deck_documents where document_id=${doc.id}`;
  await sql`delete from public.documents where id=${doc.id}`;
  await sql`delete from public.decks where id=${deck.id}`;
  await sql`delete from public."user" where id=${TEST_USER}`;
  const [left] = await sql`
    select
      (select count(*)::int from public.generation_jobs where user_id=${TEST_USER}) as jobs,
      (select count(*)::int from public.notifications where user_id=${TEST_USER}) as notifs,
      (select count(*)::int from public.documents where id=${doc.id}) as docs`;
  ok("data uji bersih", left.jobs === 0 && left.notifs === 0 && left.docs === 0, JSON.stringify(left));
} catch (e) {
  ok("eksekusi verifikasi tanpa error", false, e.message);
} finally {
  // Safety cleanup bila gagal di tengah jalan
  try {
    await sql`delete from public.notifications where user_id=${TEST_USER}`;
    await sql`delete from public.generation_jobs where user_id=${TEST_USER}`;
    await sql`delete from public.candidate_keywords where document_id in (select id from public.documents where user_id=${TEST_USER})`;
    await sql`delete from public.deck_documents where deck_id in (select id from public.decks where user_id=${TEST_USER})`;
    await sql`delete from public.documents where user_id=${TEST_USER}`;
    await sql`delete from public.decks where user_id=${TEST_USER}`;
    await sql`delete from public."user" where id=${TEST_USER}`;
  } catch { /* best-effort */ }
  await sql.end();
}

const failed = results.filter(r => !r.pass);
console.log(`\nRingkasan: ${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exit(1);
