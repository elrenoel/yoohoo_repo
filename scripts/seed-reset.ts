import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { assertDatabaseCapacity, databaseSize, formatBytes, seedSql } from "./seed-lib";

if (process.env.NODE_ENV === "production") throw new Error("Reset seed ditolak di production.");
const dryRun = process.argv.includes("--dry-run");
const confirmed = process.argv.includes("--confirm");
if (dryRun === confirmed) throw new Error("Gunakan tepat satu mode: --dry-run atau --confirm.");
const sql = seedSql();
let awsCalls = 0;

async function counts() {
  const rows = await sql`select
    (select count(*) from public.public_deck_attempt_answers aa join public.public_deck_attempts a on a.id=aa.attempt_id join public.public_decks d on d.id=a.public_deck_id where d.is_demo) attempt_answers,
    (select count(*) from public.public_deck_attempts a where exists(select 1 from public.public_decks d where d.id=a.public_deck_id and d.is_demo) or exists(select 1 from public."user" u where u.id=a.user_id and u.is_demo)) attempts,
    (select count(*) from public.comments c where exists(select 1 from public."user" u where u.id=c.author_id and u.is_demo) or (c.target_type='post' and exists(select 1 from public.posts p where p.id=c.target_id and p.is_demo)) or (c.target_type='public_deck' and exists(select 1 from public.public_decks d where d.id=c.target_id and d.is_demo))) comments,
    (select count(*) from public.likes l where exists(select 1 from public."user" u where u.id=l.user_id and u.is_demo) or (l.target_type='post' and exists(select 1 from public.posts p where p.id=l.target_id and p.is_demo)) or (l.target_type='public_deck' and exists(select 1 from public.public_decks d where d.id=l.target_id and d.is_demo))) likes,
    (select count(*) from public.bookmarks b where exists(select 1 from public."user" u where u.id=b.user_id and u.is_demo) or (b.target_type='post' and exists(select 1 from public.posts p where p.id=b.target_id and p.is_demo)) or (b.target_type='public_deck' and exists(select 1 from public.public_decks d where d.id=b.target_id and d.is_demo))) bookmarks,
    (select count(*) from public.follows f where exists(select 1 from public."user" u where u.is_demo and u.id in(f.follower_id,f.following_id))) follows,
    (select count(*) from public.notifications n where n.dedupe_key like 'seed:%' or exists(select 1 from public."user" u where u.is_demo and u.id=n.actor_id)) notifications,
    (select count(*) from public.post_images i join public.posts p on p.id=i.post_id where p.is_demo) post_images,
    (select count(*) from public.posts where is_demo) posts,
    (select count(*) from public.public_deck_questions q join public.public_decks d on d.id=q.public_deck_id where d.is_demo) questions,
    (select count(*) from public.public_deck_cards c join public.public_decks d on d.id=c.public_deck_id where d.is_demo) cards,
    (select count(*) from public.public_decks where is_demo) decks,
    (select count(*) from public.profiles where is_demo) profiles,
    (select count(*) from public."user" where is_demo) users`;
  return rows[0];
}

async function main() {
  const before = await assertDatabaseCapacity(sql);
  const preview = await counts();
  const imageRows = await sql<{ storage_path: string }[]>`select i.storage_path from public.post_images i join public.posts p on p.id=i.post_id where p.is_demo`;
  for (const row of imageRows) if (!row.storage_path.startsWith("seed/")) throw new Error(`Reset ditolak: path gambar demo di luar seed/: ${row.storage_path}`);
  console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "confirm", rows: preview, storageFiles: imageRows.length }, null, 2));
  if (dryRun) return;

  const bucket = process.env.RAG_BUCKET_NAME?.trim();
  if (!bucket && imageRows.length) throw new Error("RAG_BUCKET_NAME diperlukan untuk menghapus gambar seed.");
  const s3 = new S3Client({ region: process.env.AWS_REGION, requestChecksumCalculation: "WHEN_REQUIRED" });
  for (const row of imageRows) { await s3.send(new DeleteObjectCommand({ Bucket: bucket!, Key: row.storage_path })); awsCalls++; }

  await sql.begin(async tx => {
    await tx`delete from public.notifications n where n.dedupe_key like 'seed:%' or exists(select 1 from public."user" u where u.is_demo and u.id=n.actor_id)`;
    await tx`delete from public.public_deck_attempt_answers aa where exists(select 1 from public.public_deck_attempts a left join public.public_decks d on d.id=a.public_deck_id left join public."user" u on u.id=a.user_id where a.id=aa.attempt_id and (d.is_demo or u.is_demo))`;
    await tx`delete from public.public_deck_attempts a where exists(select 1 from public.public_decks d where d.id=a.public_deck_id and d.is_demo) or exists(select 1 from public."user" u where u.id=a.user_id and u.is_demo)`;
    await tx`delete from public.comments c where exists(select 1 from public."user" u where u.id=c.author_id and u.is_demo) or (c.target_type='post' and exists(select 1 from public.posts p where p.id=c.target_id and p.is_demo)) or (c.target_type='public_deck' and exists(select 1 from public.public_decks d where d.id=c.target_id and d.is_demo))`;
    await tx`delete from public.likes l where exists(select 1 from public."user" u where u.id=l.user_id and u.is_demo) or (l.target_type='post' and exists(select 1 from public.posts p where p.id=l.target_id and p.is_demo)) or (l.target_type='public_deck' and exists(select 1 from public.public_decks d where d.id=l.target_id and d.is_demo))`;
    await tx`delete from public.bookmarks b where exists(select 1 from public."user" u where u.id=b.user_id and u.is_demo) or (b.target_type='post' and exists(select 1 from public.posts p where p.id=b.target_id and p.is_demo)) or (b.target_type='public_deck' and exists(select 1 from public.public_decks d where d.id=b.target_id and d.is_demo))`;
    await tx`delete from public.follows f where exists(select 1 from public."user" u where u.is_demo and u.id in(f.follower_id,f.following_id))`;
    await tx`delete from public.post_images i where exists(select 1 from public.posts p where p.id=i.post_id and p.is_demo)`;
    await tx`delete from public.posts where is_demo=true`;
    await tx`delete from public.public_decks where is_demo=true`;
    await tx`delete from public.profiles where is_demo=true`;
    await tx`delete from public."user" where is_demo=true`;
    await tx`update public.posts p set like_count=(select count(*) from public.likes l where l.target_type='post' and l.target_id=p.id), comment_count=(select count(*) from public.comments c where c.target_type='post' and c.target_id=p.id and c.deleted_at is null) where p.is_demo=false`;
    await tx`update public.public_decks d set like_count=(select count(*) from public.likes l where l.target_type='public_deck' and l.target_id=d.id), comment_count=(select count(*) from public.comments c where c.target_type='public_deck' and c.target_id=d.id and c.deleted_at is null) where d.is_demo=false`;
  });
  const after = await databaseSize(sql);
  console.log(JSON.stringify({ deleted: preview, remaining: await counts(), databaseBefore: formatBytes(before), databaseAfter: formatBytes(after), databaseDelta: formatBytes(after - before), geminiCalls: 0, awsCalls, storageFilesDeleted: imageRows.length }, null, 2));
}

void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => sql.end({ timeout: 5 }));
