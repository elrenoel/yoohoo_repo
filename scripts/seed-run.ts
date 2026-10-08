import { readFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import type { TransactionSql } from "postgres";
import { USER_COUNT, DB_DELTA_LIMIT, assertDatabaseCapacity, chunks, databaseSize, formatBytes, id, rng, seedSql, seedUserSchema, slugify, type SeedUser } from "./seed-lib";

type DbValue = string | number | boolean | Date | null | string[];
type Row = Record<string, DbValue>;
const sql = seedSql();
const random = rng(20261007);
const bucket = process.env.RAG_BUCKET_NAME?.trim();
if (!bucket) throw new Error("RAG_BUCKET_NAME belum diatur; aplikasi memakai S3 untuk gambar post.");
const s3 = new S3Client({ region: process.env.AWS_REGION, requestChecksumCalculation: "WHEN_REQUIRED" });
let awsCalls = 0;

const dateAgo = (days: number) => new Date(Date.now() - random() * days * 86_400_000);
async function loadUsers() {
  const result: SeedUser[] = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const file = path.join(process.cwd(), "scripts", "seed-data", "users", `user-${String(i + 1).padStart(2, "0")}.json`);
    result.push(seedUserSchema.parse(JSON.parse(await readFile(file, "utf8"))));
  }
  if (new Set(result.map(user => user.username)).size !== USER_COUNT) throw new Error("Username cache seed tidak unik.");
  return result;
}

async function bulk(tx: TransactionSql, table: string, rows: Row[], columns: string[], conflict = "") {
  // Force JSON through text first. A direct ::jsonb cast makes postgres.js use
  // its JSON encoder and a pre-stringified array becomes a JSON scalar string.
  const cast = (column: string) => column === "options" ? "::text::jsonb" : column === "tags" ? "::text[]" : "";
  for (const batch of chunks(rows)) await tx.unsafe(`insert into ${table} (${columns.map(c => `"${c}"`).join(",")}) values ${batch.map((_, i) => `(${columns.map((column, j) => `$${i * columns.length + j + 1}${cast(column)}`).join(",")})`).join(",")} ${conflict}`,
    batch.flatMap(row => columns.map(column => row[column])));
}

async function phase(baseline: number, operation: (tx: TransactionSql) => Promise<void>) {
  await sql.begin(async tx => {
    await operation(tx);
    const size = await databaseSize(tx);
    if (size - baseline > DB_DELTA_LIMIT) throw new Error(`Fase di-rollback: pertumbuhan database ${formatBytes(size - baseline)} melebihi batas total 50 MB.`);
  });
}

function escapeXml(value: string) { return value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!); }
async function imageBytes(user: SeedUser, index: number) {
  const spec = user.image_spec!;
  const [width, height] = index % 2 ? [1200, 900] : [1080, 1350];
  const points = spec.points.map((point, i) => `<text x="130" y="${330 + i * 120}" font-family="Arial,sans-serif" font-size="38" fill="#16241D">• ${escapeXml(point)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#F5F6F3"/><line x1="78" y1="0" x2="78" y2="100%" stroke="#C24A3D" stroke-width="5"/><text x="130" y="170" font-family="Arial,sans-serif" font-size="68" font-weight="700" fill="#16241D">${escapeXml(spec.title)}</text><line x1="130" y1="220" x2="${width - 90}" y2="220" stroke="#D8DCD3" stroke-width="3"/>${points}</svg>`;
  const output = await sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
  if (output.byteLength > 500 * 1024) throw new Error(`Gambar user ${index + 1} melebihi 500 KB.`);
  return { output, width, height };
}

async function main() {
  const before = await assertDatabaseCapacity(sql);
  const users = await loadUsers();
  const existing = await sql<{ users: number; decks: number; posts: number }[]>`select
    (select count(*)::int from public."user" where is_demo) users,
    (select count(*)::int from public.public_decks where is_demo) decks,
    (select count(*)::int from public.posts where is_demo) posts`;
  if (existing[0].users === 50 && existing[0].decks === 100 && existing[0].posts === 50) {
    console.log("Seed sudah lengkap; tidak ada insert atau upload ulang."); await verify(before); return;
  }
  if (existing[0].users || existing[0].decks || existing[0].posts) throw new Error("Seed parsial ditemukan. Jalankan npm run seed:reset -- --dry-run lalu --confirm.");

  const userRows = users.map((user, i) => ({ id: id(`user:${i}`), name: user.display_name, email: `seed.${String(i + 1).padStart(2, "0")}@demo.yoohoo.invalid`, email_verified: false, is_demo: true }));
  const profileRows = users.map((user, i) => ({ user_id: id(`user:${i}`), username: user.username, display_name: user.display_name, bio: user.bio, is_demo: true }));
  await phase(before, async tx => {
    await bulk(tx, 'public."user"', userRows, ["id", "name", "email", "email_verified", "is_demo"]);
    await bulk(tx, "public.profiles", profileRows, ["user_id", "username", "display_name", "bio", "is_demo"]);
  });

  const deckRows: Row[] = [], cardRows: Row[] = [], questionRows: Row[] = [];
  users.forEach((user, ui) => user.decks.forEach((deck, di) => {
    const deckId = id(`deck:${ui}:${di}`), published = dateAgo(30);
    deckRows.push({ id: deckId, owner_id: id(`user:${ui}`), slug: `${slugify(deck.title)}-${ui + 1}-${di + 1}`, title: deck.title, description: deck.description, tags: deck.tags, language: "id", status: "published", version: 1, published_at: published, updated_at: published, is_demo: true });
    deck.cards.forEach((card, ci) => cardRows.push({ id: id(`card:${ui}:${di}:${ci}`), public_deck_id: deckId, position: ci + 1, front: card.front, back: card.back, content_type: "concept" }));
    deck.questions.forEach((q, qi) => questionRows.push({ id: id(`question:${ui}:${di}:${qi}`), public_deck_id: deckId, position: qi + 1, question: q.question, options: JSON.stringify(q.options), correct_index: q.correct_index, explanation: q.explanation, difficulty: qi % 4 === 0 ? "hard" : qi % 2 ? "medium" : "easy" }));
  }));
  await phase(before, async tx => {
    await bulk(tx, "public.public_decks", deckRows, ["id", "owner_id", "slug", "title", "description", "tags", "language", "status", "version", "published_at", "updated_at", "is_demo"]);
    await bulk(tx, "public.public_deck_cards", cardRows, ["id", "public_deck_id", "position", "front", "back", "content_type"]);
    await bulk(tx, "public.public_deck_questions", questionRows, ["id", "public_deck_id", "position", "question", "options", "correct_index", "explanation", "difficulty"]);
  });

  const postRows: Row[] = [], imageRows: Row[] = [], uploaded: string[] = [];
  try {
    for (let ui = 0; ui < users.length; ui++) {
      const user = users[ui], postId = id(`post:${ui}`), deckId = ui % 3 === 2 ? id(`deck:${ui}:0`) : null;
      const deckPublished = deckRows[ui * 2].published_at as Date;
      const published = new Date(Math.max(dateAgo(14).getTime(), deckId ? deckPublished.getTime() + 60_000 : 0));
      postRows.push({ id: postId, author_id: id(`user:${ui}`), slug: `${slugify(user.caption.slice(0, 45))}-${ui + 1}`, title: user.caption.slice(0, 120), excerpt: user.caption.slice(0, 300), body_md: user.caption, body: user.caption, tags: user.post_tags, embedded_public_deck_id: deckId, status: "published", published_at: published, created_at: published, updated_at: published, is_demo: true });
      if (ui % 3 === 1) {
        const rendered = await imageBytes(user, ui), key = `seed/post-${String(ui + 1).padStart(2, "0")}.webp`;
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: rendered.output, ContentType: "image/webp", CacheControl: "public,max-age=31536000,immutable" })); awsCalls++; uploaded.push(key);
        imageRows.push({ id: id(`image:${ui}`), post_id: postId, owner_id: id(`user:${ui}`), storage_path: key, width: rendered.width, height: rendered.height, alt_text: user.image_spec!.title, position: 1, created_at: published });
      }
    }
    await phase(before, async tx => {
      await bulk(tx, "public.posts", postRows, ["id", "author_id", "slug", "title", "excerpt", "body_md", "body", "tags", "embedded_public_deck_id", "status", "published_at", "created_at", "updated_at", "is_demo"]);
      await bulk(tx, "public.post_images", imageRows, ["id", "post_id", "owner_id", "storage_path", "width", "height", "alt_text", "position", "created_at"]);
    });
  } catch (error) {
    for (const key of uploaded) { await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); awsCalls++; }
    throw error;
  }

  const follows: Row[] = [];
  for (let follower = 0; follower < 50; follower++) {
    const count = 8 + Math.floor(random() * 8), chosen = new Set<number>();
    while (chosen.size < count) { const rank = Math.min(49, Math.floor(Math.exp(random() * Math.log(50)))); if (rank !== follower) chosen.add(rank); }
    for (const following of chosen) follows.push({ follower_id: id(`user:${follower}`), following_id: id(`user:${following}`), created_at: dateAgo(14) });
  }
  const me = await sql<{ user_id: string }[]>`select user_id from public.profiles where username='elrenoel' and not is_demo limit 1`;
  if (me[0]) for (let i = 0; i < 12; i++) follows.push({ follower_id: me[0].user_id, following_id: id(`user:${i}`), created_at: dateAgo(7) });

  const likes: Row[] = [], bookmarks: Row[] = [], comments: Row[] = [];
  for (let ui = 0; ui < 50; ui++) for (let n = 1; n <= 4; n++) {
    const actor = id(`user:${(ui + n * 7) % 50}`), postTarget = id(`post:${ui}`), deckTarget = id(`deck:${ui}:${n % 2}`);
    likes.push({ user_id: actor, target_type: "post", target_id: postTarget, created_at: dateAgo(10) }, { user_id: actor, target_type: "public_deck", target_id: deckTarget, created_at: dateAgo(10) });
    if (n <= 2) bookmarks.push({ user_id: actor, target_type: n === 1 ? "post" : "public_deck", target_id: n === 1 ? postTarget : deckTarget, created_at: dateAgo(8) });
    const commentId = id(`comment:${ui}:${n}`);
    comments.push({ id: commentId, target_type: n % 2 ? "post" : "public_deck", target_id: n % 2 ? postTarget : deckTarget, author_id: actor, parent_id: null, body: ["Rangkumannya membantu banget.", "Penjelasannya jadi lebih mudah dipahami.", "Aku coba pelajari ini malam ini.", "Topiknya menarik, terima kasih sudah berbagi!"][n - 1], created_at: dateAgo(7) });
    if (n === 1) comments.push({ id: id(`reply:${ui}`), target_type: "post", target_id: postTarget, author_id: id(`user:${(ui + 13) % 50}`), parent_id: commentId, body: "Setuju, bagian intinya jelas.", created_at: dateAgo(6) });
  }
  await phase(before, async tx => {
    await bulk(tx, "public.follows", follows, ["follower_id", "following_id", "created_at"], "on conflict do nothing");
    await bulk(tx, "public.likes", likes, ["user_id", "target_type", "target_id", "created_at"], "on conflict do nothing");
    await bulk(tx, "public.bookmarks", bookmarks, ["user_id", "target_type", "target_id", "created_at"], "on conflict do nothing");
    await bulk(tx, "public.comments", comments, ["id", "target_type", "target_id", "author_id", "parent_id", "body", "created_at"], "on conflict do nothing");
  });

  const attempts: Row[] = [], answers: Row[] = [];
  users.forEach((user, ui) => user.decks.forEach((deck, di) => {
    const attemptCount = 5 + Math.floor(random() * 36), targetAverage = 0.55 + random() * 0.35;
    for (let ai = 0; ai < attemptCount; ai++) {
      const attemptId = id(`attempt:${ui}:${di}:${ai}`), total = deck.questions.length;
      const score = Math.max(0, Math.min(total, Math.round(total * (targetAverage + (random() - .5) * .25))));
      attempts.push({ id: attemptId, public_deck_id: id(`deck:${ui}:${di}`), user_id: id(`user:${(ui + ai + 1) % 50}`), score, total, duration_ms: 35_000 + Math.floor(random() * 180_000), created_at: dateAgo(30) });
      deck.questions.forEach((q, qi) => answers.push({ attempt_id: attemptId, question_id: id(`question:${ui}:${di}:${qi}`), selected_index: qi < score ? q.correct_index : (q.correct_index + 1 + Math.floor(random() * 3)) % 4, is_correct: qi < score, time_taken_ms: 4_000 + Math.floor(random() * 25_000) }));
    }
  }));
  await phase(before, async tx => {
    await bulk(tx, "public.public_deck_attempts", attempts, ["id", "public_deck_id", "user_id", "score", "total", "duration_ms", "created_at"]);
    await bulk(tx, "public.public_deck_attempt_answers", answers, ["attempt_id", "question_id", "selected_index", "is_correct", "time_taken_ms"]);
  });

  await phase(before, async tx => {
    await tx`update public.posts p set like_count=(select count(*) from public.likes l where l.target_type='post' and l.target_id=p.id), comment_count=(select count(*) from public.comments c where c.target_type='post' and c.target_id=p.id and c.deleted_at is null) where p.is_demo`;
    await tx`update public.public_decks d set like_count=(select count(*) from public.likes l where l.target_type='public_deck' and l.target_id=d.id), comment_count=(select count(*) from public.comments c where c.target_type='public_deck' and c.target_id=d.id and c.deleted_at is null), fork_count=0, view_count=0 where d.is_demo`;
    if (me[0]) {
      const notificationRows: Row[] = [];
      for (let i = 0; i < 10; i++) notificationRows.push({ user_id: me[0].user_id, actor_id: id(`user:${i}`), type: i < 3 ? "new_follower" : i < 7 ? "like" : "comment", severity: "info", title: i < 3 ? "Pengikut baru" : i < 7 ? "Kontenmu disukai" : "Komentar baru", body: `${users[i].display_name} berinteraksi dengan kontenmu.`, link: `/u/${users[i].username}`, target_type: "user", target_id: me[0].user_id, dedupe_key: `seed:${i}`, created_at: dateAgo(5) });
      await bulk(tx, "public.notifications", notificationRows, ["user_id", "actor_id", "type", "severity", "title", "body", "link", "target_type", "target_id", "dedupe_key", "created_at"], "on conflict do nothing");
    }
  });
  const after = await databaseSize(sql);
  if (after - before > DB_DELTA_LIMIT) throw new Error(`Ukuran database bertambah ${formatBytes(after - before)}, melebihi 50 MB. Jalankan reset terkonfirmasi.`);
  await verify(before);
}

async function verify(before: number) {
  const counts = await sql`select
    (select count(*) from public."user" where is_demo) users,
    (select count(*) from public.public_decks where is_demo) public_decks,
    (select count(*) from public.posts where is_demo) posts,
    (select count(*) from public.post_images i join public.posts p on p.id=i.post_id where p.is_demo) post_images,
    (select count(*) from public.follows f where exists(select 1 from public."user" u where u.is_demo and u.id in(f.follower_id,f.following_id))) follows,
    (select count(*) from public.likes l where exists(select 1 from public."user" u where u.is_demo and u.id=l.user_id)) likes,
    (select count(*) from public.bookmarks b where exists(select 1 from public."user" u where u.is_demo and u.id=b.user_id)) bookmarks,
    (select count(*) from public.comments c where exists(select 1 from public."user" u where u.is_demo and u.id=c.author_id)) comments,
    (select count(*) from public.public_deck_attempts a join public.public_decks d on d.id=a.public_deck_id where d.is_demo) attempts`;
  const types = await sql`select count(*) filter(where i.post_id is null and p.embedded_public_deck_id is null) text_only,
    count(*) filter(where i.post_id is not null) image, count(*) filter(where p.embedded_public_deck_id is not null) deck
    from public.posts p left join public.post_images i on i.post_id=p.id where p.is_demo`;
  const popularDecks = await sql`select d.title,count(a.id)::int attempts,round(avg(a.score::numeric/a.total*100),1) average from public.public_decks d left join public.public_deck_attempts a on a.public_deck_id=d.id where d.is_demo group by d.id order by attempts desc limit 3`;
  const popularUsers = await sql`select p.username,count(f.follower_id)::int followers from public.profiles p left join public.follows f on f.following_id=p.user_id where p.is_demo group by p.user_id order by followers desc limit 3`;
  const feed = await sql`with items as (
    select p.id,'post' type,p.published_at from public.posts p join public.follows f on f.following_id=p.author_id join public.profiles me on me.user_id=f.follower_id where me.username='elrenoel' and p.status='published' and p.deleted_at is null
    union all
    select d.id,'deck',d.published_at from public.public_decks d join public.follows f on f.following_id=d.owner_id join public.profiles me on me.user_id=f.follower_id where me.username='elrenoel' and d.status='published' and not exists(select 1 from public.posts p where p.embedded_public_deck_id=d.id and p.status='published' and p.deleted_at is null)
  ) select id,type,published_at from items order by published_at desc,id desc limit 20`;
  const duplicate = new Set(feed.map(row => String(row.id))).size !== feed.length;
  const after = await databaseSize(sql);
  console.log(JSON.stringify({ counts: counts[0], postTypes: types[0], popularDecks, popularUsers, feed: feed.map(row => ({ type: row.type, id: row.id })), duplicateDeckInFeed: duplicate, attemptPrivacy: "Script hanya mencetak agregat; tidak membaca daftar attempt pengguna lain.", databaseBefore: formatBytes(before), databaseAfter: formatBytes(after), databaseDelta: formatBytes(after - before), geminiCalls: 0, awsCalls, storageFiles: 17 }, null, 2));
}

void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => sql.end({ timeout: 5 }));
