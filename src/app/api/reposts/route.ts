import { ZodError } from "zod";
import { ragSql } from "@/lib/rag/db";
import { jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
import { targetSchema, targetTable } from "@/lib/social";
import { interactionNotificationCopy, interactionNotificationKey, shouldCreateInteractionNotification } from "@/lib/interaction-notifications";
import { checkUserRateLimit, rateLimitResponse } from "@/lib/user-rate-limit";

export async function POST(request: Request) {
  try {
    const userId = await sessionUser(request);
    const rate = await checkUserRateLimit(userId, "repost", 60);
    if (!rate.allowed) return rateLimitResponse(rate);
    const input = targetSchema.parse(await jsonBody(request));
    const sql = ragSql();
    const result = await sql.begin(async tx => {
      const table = targetTable(input.targetType);
      const target = table === "posts"
        ? await tx`select id,author_id owner_id,slug,title from public.posts where id=${input.targetId} and status='published' and deleted_at is null for update`
        : await tx`select id,owner_id,slug,title from public.public_decks where id=${input.targetId} and status='published' for update`;
      if (!target[0]) return null;
      const inserted = await tx`insert into public.reposts(user_id,target_type,target_id) values(${userId},${input.targetType},${input.targetId}) on conflict do nothing returning target_id`;
      if (inserted.length) {
        if (table === "posts") await tx`update public.posts set repost_count=repost_count+1 where id=${input.targetId}`;
        else await tx`update public.public_decks set repost_count=repost_count+1 where id=${input.targetId}`;
        if (shouldCreateInteractionNotification(String(target[0].owner_id), userId)) {
          const [actor] = await tx`select coalesce(p.display_name,u.name,'Seseorang') display_name from public."user" u left join public.profiles p on p.user_id=u.id where u.id=${userId}`;
          const title = interactionNotificationCopy(String(actor?.display_name ?? "Seseorang"), "repost", input.targetType);
          const dedupeKey = interactionNotificationKey(userId, "repost", input.targetType, input.targetId);
          await tx`insert into public.notifications(user_id,actor_id,type,severity,title,body,link,target_type,target_id,dedupe_key)
            values(${target[0].owner_id},${userId},'repost','info',${title},${title},${`/${input.targetType === "post" ? "p" : "d"}/${target[0].slug}`},${input.targetType},${input.targetId},${dedupeKey})
            on conflict(dedupe_key) do nothing`;
        }
      }
      const count = table === "posts" ? await tx`select repost_count from public.posts where id=${input.targetId}` : await tx`select repost_count from public.public_decks where id=${input.targetId}`;
      return Number(count[0]?.repost_count ?? 0);
    });
    if (result === null) return Response.json({ error: "Content not found." }, { status: 404 });
    return Response.json({ reposted: true, repostCount: result });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid target." }, { status: 400 });
    return ragResponseError(error);
  }
}

export function PUT(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    const userId = await sessionUser(request);
    const rate = await checkUserRateLimit(userId, "repost", 60);
    if (!rate.allowed) return rateLimitResponse(rate);
    const input = targetSchema.parse(await jsonBody(request));
    const sql = ragSql();
    const count = await sql.begin(async tx => {
      const deleted = await tx`delete from public.reposts where user_id=${userId} and target_type=${input.targetType} and target_id=${input.targetId} returning target_id`;
      const table = targetTable(input.targetType);
      if (deleted.length) {
        if (table === "posts") await tx`update public.posts set repost_count=greatest(0,repost_count-1) where id=${input.targetId}`;
        else await tx`update public.public_decks set repost_count=greatest(0,repost_count-1) where id=${input.targetId}`;
        const dedupeKey = interactionNotificationKey(userId, "repost", input.targetType, input.targetId);
        await tx`delete from public.notifications where dedupe_key=${dedupeKey} and actor_id=${userId} and type='repost'`;
      }
      const rows = table === "posts" ? await tx`select repost_count from public.posts where id=${input.targetId}` : await tx`select repost_count from public.public_decks where id=${input.targetId}`;
      return Number(rows[0]?.repost_count ?? 0);
    });
    return Response.json({ reposted: false, repostCount: count });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid target." }, { status: 400 });
    return ragResponseError(error);
  }
}
