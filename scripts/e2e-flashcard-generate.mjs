// E2E alur generate flashcard multi-materi lewat HTTP (dev server :3000).
// Jalankan: node scripts/e2e-flashcard-generate.mjs
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const env = readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DATABASE_URL="(.+)"$/m)?.[1];
if (!url) throw new Error("SUPABASE_DATABASE_URL tidak ditemukan di .env.local");
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, ssl: "require" });

const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
};
const stamp = Date.now();
const cleanupIds = { userId: null, deckId: null, documentId: null, jobId: null };

async function cleanup() {
  const { userId, deckId, documentId, jobId } = cleanupIds;
  try {
    if (jobId) await sql`delete from public.notifications where job_id=${jobId}`;
    if (documentId) await sql`delete from public.candidate_keywords where document_id=${documentId}`;
    if (documentId) await sql`delete from public.document_chunks where document_id=${documentId}`;
    if (documentId) await sql`delete from public.flashcards where document_id=${documentId}`;
    if (deckId) await sql`delete from public.generation_jobs where deck_id=${deckId}`;
    if (documentId) await sql`delete from public.deck_documents where document_id=${documentId}`;
    if (documentId) await sql`delete from public.documents where id=${documentId}`;
    if (deckId) await sql`delete from public.decks where id=${deckId}`;
    if (userId) await sql`delete from public."user" where id=${userId}`;
  } catch (error) {
    console.log(`WARN | cleanup: ${error.message}`);
  }
}

try {
  // 1. Sign up -> session cookie
  const signUp = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email: `e2e-gen-${stamp}@example.com`, password: "E2eTest-12345!", name: "E2E Gen" }),
  });
  const signUpBody = await signUp.json();
  if (!signUp.ok) throw new Error(`sign-up gagal: ${JSON.stringify(signUpBody)}`);
  const userId = signUpBody.user?.id;
  cleanupIds.userId = userId;
  const cookie = (signUp.headers.getSetCookie?.() ?? [])
    .map(c => c.split(";")[0]).join("; ");
  ok("sign up + session cookie", Boolean(userId && cookie), `user=${userId}`);

  // 2. Data uji via SQL: deck + materi siap + chunk + 2 keyword
  const [deck] = await sql`insert into public.decks (user_id, title) values (${userId}, 'E2E-GEN') returning id`;
  cleanupIds.deckId = deck.id;
  const [doc] = await sql`
    insert into public.documents (user_id, title, raw_text, status, document_summary, content_language)
    values (${userId}, 'E2E MATERI', 'Materi uji end-to-end untuk generate flashcard.', 'ready_for_selection',
            'Ringkasan materi uji end-to-end.', 'id')
    returning id`;
  cleanupIds.documentId = doc.id;
  await sql`insert into public.deck_documents (deck_id, document_id) values (${deck.id}, ${doc.id})`;
  const [chunk] = await sql`
    insert into public.document_chunks (id, document_id, chunk_index, page_start, page_end, content)
    values (gen_random_uuid(), ${doc.id}, 0, 1, 1,
            'Pernapasan seluler adalah proses penguraian glukosa menjadi ATP dengan oksigen sebagai penerima elektron akhir.')
    returning id`;
  const [kw1] = await sql`
    insert into public.candidate_keywords (document_id, chunk_id, term, snippet)
    values (${doc.id}, ${chunk.id}, 'mitokondria', 'Organel tempat berlangsungnya respirasi seluler dan produksi ATP.')
    returning id`;
  const [kw2] = await sql`
    insert into public.candidate_keywords (document_id, chunk_id, term, snippet)
    values (${doc.id}, ${chunk.id}, 'adenosin trifosfat', 'Molekul penyimpan energi utama bagi sel.')
    returning id`;
  ok("data uji deck+materi+chunk+keyword", true, `deck=${deck.id}`);

  const auth = { Cookie: cookie, "Content-Type": "application/json", Origin: BASE };

  // 3. GET materi deck (endpoint LANGKAH 2)
  const docsRes = await fetch(`${BASE}/api/decks/${deck.id}/documents?ready=1`, { headers: auth });
  const docsBody = await docsRes.json();
  ok("GET /api/decks/:id/documents", docsRes.ok && docsBody.documents?.length === 1,
    `status=${docsRes.status} count=${docsBody.documents?.length ?? 0}`);

  // 4. GET keyword deck (endpoint LANGKAH 2)
  const kwRes = await fetch(`${BASE}/api/decks/${deck.id}/keywords?documentIds=${doc.id}`, { headers: auth });
  const kwBody = await kwRes.json();
  const flatKeywords = (kwBody.documents ?? []).flatMap(g => g.keywords ?? []);
  ok("GET /api/decks/:id/keywords", kwRes.ok && flatKeywords.length === 2,
    `status=${kwRes.status} keywords=${flatKeywords.length}`);

  // 5. POST generate -> 202 + jobId
  const idempotencyKey = `e2e-${stamp}`;
  const genRes = await fetch(`${BASE}/api/decks/${deck.id}/flashcards/generate`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ documentIds: [doc.id], keywordIds: [kw1.id, kw2.id], idempotencyKey }),
  });
  const genBody = await genRes.json();
  cleanupIds.jobId = genBody.jobId;
  ok("POST generate -> 202 + jobId", genRes.status === 202 && Boolean(genBody.jobId),
    `status=${genRes.status} jobId=${genBody.jobId ?? "-"} ${genBody.error ?? ""}`);
  if (!genBody.jobId) throw new Error("generate tidak mengembalikan jobId");

  // 6. Idempoten: klik kedua dengan key sama -> job yang sama, tidak ada job kedua
  const gen2 = await fetch(`${BASE}/api/decks/${deck.id}/flashcards/generate`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ documentIds: [doc.id], keywordIds: [kw1.id, kw2.id], idempotencyKey }),
  });
  const gen2Body = await gen2.json();
  const [jobCount] = await sql`select count(*)::int as c from public.generation_jobs where idempotency_key=${idempotencyKey} and user_id=${userId}`;
  ok("idempotency: klik ulang job sama", gen2.status === 202 && gen2Body.jobId === genBody.jobId && jobCount.c === 1,
    `status=${gen2.status} jobId sama=${gen2Body.jobId === genBody.jobId} jumlah job=${jobCount.c} ${gen2Body.error ?? ""}`);

  // 7. Poll status job sampai terminal (worker dijalankan via after())
  let job = null;
  for (let i = 0; i < 60; i += 1) {
    const res = await fetch(`${BASE}/api/jobs/${genBody.jobId}`, { headers: auth });
    const body = await res.json();
    if (!res.ok) { await new Promise(r => setTimeout(r, 2000)); continue; }
    job = body.job;
    if (["succeeded", "completed", "failed", "canceled"].includes(job.status)) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  ok("worker menyelesaikan job (terminal)", Boolean(job) &&
    ["succeeded", "completed", "failed", "canceled"].includes(job.status),
    `status=${job?.status ?? "-"} error=${job?.errorMessage ?? "-"} flashcards=${job?.flashcardCount ?? 0}`);

  // 8. Notifikasi dari trigger (queued + terminal), tanpa duplikat
  const notifs = await sql`
    select dedupe_key, severity, title, link from public.notifications
    where job_id=${genBody.jobId} order by created_at`;
  const keys = notifs.map(n => n.dedupe_key);
  ok("notifikasi trigger (queued + terminal)", notifs.length >= 2 && new Set(keys).size === keys.length,
    `count=${notifs.length} keys=${keys.join(",")}`);

  // 9. Hasil flashcard bila sukses
  if (job?.status === "succeeded" || job?.status === "completed") {
    const [cards] = await sql`select count(*)::int as c from public.flashcards where job_id=${genBody.jobId}`;
    ok("flashcard tersimpan (ON CONFLICT deck_id, keyword_id)", cards.c >= 1, `jumlah=${cards.c}`);
  } else {
    console.log(`INFO | job berstatus ${job?.status} — insert flashcard dilewati (lihat error_message).`);
  }

  // 10. Ditolak: 0 keyword valid (keyword bukan milik user/material lain)
  const badRes = await fetch(`${BASE}/api/decks/${deck.id}/flashcards/generate`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ documentIds: [doc.id], keywordIds: [], idempotencyKey: `e2e-empty-${stamp}` }),
  });
  ok("tolak 0 keyword", badRes.status >= 400, `status=${badRes.status}`);
} catch (error) {
  ok("e2e selesai tanpa error", false, error.message);
} finally {
  await cleanup();
  console.log("cleanup: data uji dihapus");
  await sql.end();
  const failed = results.filter(r => !r.pass).length;
  console.log(failed ? `\n${failed} CHECK GAGAL` : "\nSEMUA CHECK LOLOS");
  process.exit(failed ? 1 : 0);
}
