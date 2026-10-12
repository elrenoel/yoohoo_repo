import { ragSql } from "@/lib/rag/db";
import { ragResponseError, sessionUser } from "@/lib/rag/http";
import { checkUserRateLimit, rateLimitResponse } from "@/lib/user-rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const followerId = await sessionUser(request);
    const rate = await checkUserRateLimit(followerId, "follow", 30);
    if (!rate.allowed) return rateLimitResponse(rate);
    const { userId: followingId } = await params;
    if (followerId === followingId) return Response.json({ error: "You cannot follow yourself." }, { status: 400 });
    const sql = ragSql();
    const result = await sql.begin(async tx => {
      const target = await tx`select p.username,p.display_name from public.profiles p where p.user_id=${followingId}`;
      if (!target[0]) return null;
      const inserted = await tx`insert into public.follows(follower_id,following_id) values(${followerId},${followingId}) on conflict do nothing returning created_at`;
      if (inserted[0]) {
        const actor = await tx`select coalesce(p.display_name,u.name) display_name,p.username from public."user" u left join public.profiles p on p.user_id=u.id where u.id=${followerId}`;
        const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
        const prefix = `follow:${followerId}:${followingId}:`;
        await tx`insert into public.notifications(user_id,type,severity,title,body,link,dedupe_key)
          select ${followingId},'new_follower','info',${`${actor[0]?.display_name ?? "Someone"} started following you`},${`@${actor[0]?.username ?? "user"} now follows your profile.`},${actor[0]?.username ? `/u/${actor[0].username}` : null},${`${prefix}${bucket}`}
          where not exists(select 1 from public.notifications where user_id=${followingId} and dedupe_key like ${`${prefix}%`} and created_at>now()-interval '1 hour') on conflict(dedupe_key) do nothing`;
      }
      return { following: true, created: Boolean(inserted[0]) };
    });
    if (!result) return Response.json({ error: "User not found." }, { status: 404 });
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) { return ragResponseError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const followerId = await sessionUser(request);
    const rate = await checkUserRateLimit(followerId, "follow", 30);
    if (!rate.allowed) return rateLimitResponse(rate);
    const { userId: followingId } = await params;
    await ragSql()`delete from public.follows where follower_id=${followerId} and following_id=${followingId}`;
    return Response.json({ following: false });
  } catch (error) { return ragResponseError(error); }
}

export function PUT(request: Request, context: { params: Promise<{ userId: string }> }) { return POST(request, context); }
