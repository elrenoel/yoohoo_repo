import { randomUUID } from "node:crypto";
import { sessionUser, jsonBody, ragResponseError } from "@/lib/rag/http";
import { ragSql } from "@/lib/rag/db";
import { createProfileSchema, updateProfileSchema } from "@/lib/profile-validation";
import { getOwnProfile } from "@/lib/profile-server";
import { ZodError } from "zod";
import { withApiTiming } from "@/lib/api-timing";
import { revalidateTag } from "next/cache";
import { db } from "@/db";

export const runtime = "nodejs";

const AVATAR_MARKER = "/storage/v1/object/public/profile-avatars/";
function ownedAvatarPath(value: unknown, userId: string) {
  if (typeof value !== "string") return null;
  try {
    const pathname = new URL(value).pathname;
    const index = pathname.indexOf(AVATAR_MARKER);
    if (index < 0) return null;
    const path = decodeURIComponent(pathname.slice(index + AVATAR_MARKER.length));
    return path.startsWith(`${userId}/`) ? path : null;
  } catch { return null; }
}

function friendlyError(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Data profil tidak valid." }, { status: 400 });
  if ((error as { code?: string })?.code === "23505") return Response.json({ error: "Username sudah dipakai. Silakan pilih username lain." }, { status: 409 });
  return ragResponseError(error);
}

export async function GET(request: Request) {
  return withApiTiming(request, "GET /api/profile", async (time) => {
    try {
      const userId = await time("auth", () => sessionUser(request));
      const profile = await time("db.profile", () => getOwnProfile(userId));
      return Response.json({ profile });
    } catch (error) { return friendlyError(error); }
  });
}

export async function POST(request: Request) {
  try {
    const userId = await sessionUser(request);
    const input = createProfileSchema.parse(await jsonBody(request));
    const sql = ragSql();
    const profile = await sql.begin(async (tx) => {
      const rows = await tx`
        insert into public.profiles (user_id, username, display_name, bio, avatar_url)
        values (${userId}, ${input.username}, ${input.displayName}, ${input.bio},
          coalesce(${input.avatarUrl || null}, (select image from public."user" where id = ${userId})))
        returning user_id as "userId", username, display_name as "displayName", bio, avatar_url as "avatarUrl"
      `;
      await tx`
        insert into public.notifications (user_id, type, severity, title, body, link, dedupe_key)
        values (${userId}, 'profile_created', 'success', 'Profile created',
          ${`Your @${input.username} profile is ready.`}, ${`/u/${input.username}`}, ${`profile:created:${randomUUID()}`})
      `;
      return rows[0];
    });
    return Response.json({ profile }, { status: 201 });
  } catch (error) { return friendlyError(error); }
}

export async function PATCH(request: Request) {
  try {
    const userId = await sessionUser(request);
    const input = updateProfileSchema.parse(await jsonBody(request));
    const requestedUserId = input.userId ?? input.user_id;
    if (requestedUserId && requestedUserId !== userId) return Response.json({ error: "Kamu tidak boleh mengubah profil orang lain." }, { status: 403 });
    const sql = ragSql();
    const result = await sql.begin(async (tx) => {
      const current = await tx`select * from public.profiles where user_id = ${userId} for update`;
      if (!current[0]) return null;
      const username = input.username ?? current[0].username;
      const displayName = input.displayName ?? current[0].display_name;
      const bio = input.bio ?? current[0].bio;
      const avatarUrl = input.avatarUrl === undefined
        ? current[0].avatar_url
        : input.avatarUrl || (await tx`select image from public."user" where id = ${userId}`)[0]?.image || null;
      const rows = await tx`
        update public.profiles set username = ${username}, display_name = ${displayName},
          bio = ${bio}, avatar_url = ${avatarUrl}
        where user_id = ${userId}
        returning user_id as "userId", username, display_name as "displayName", bio, avatar_url as "avatarUrl"
      `;
      await tx`
        insert into public.notifications (user_id, type, severity, title, body, link, dedupe_key)
        values (${userId}, 'profile_updated', 'success', 'Profile updated',
          ${`Changes to @${username} have been saved.`}, ${`/u/${username}`}, ${`profile:updated:${randomUUID()}`})
      `;
      return { profile: rows[0], previousAvatarUrl: current[0].avatar_url };
    });
    if (!result) return Response.json({ error: "Profil belum dibuat." }, { status: 404 });
    const oldPath = result.previousAvatarUrl !== result.profile.avatarUrl ? ownedAvatarPath(result.previousAvatarUrl, userId) : null;
    if (oldPath) {
      try {
        const { error } = await db.storage.from("profile-avatars").remove([oldPath]);
        if (error) console.warn("[profile avatar cleanup]", error.message);
      } catch (error) {
        console.warn("[profile avatar cleanup]", error instanceof Error ? error.message : "unknown error");
      }
    }
    revalidateTag("explore-featured", { expire: 0 });
    revalidateTag("explore-learners", { expire: 0 });
    return Response.json({ profile: result.profile });
  } catch (error) { return friendlyError(error); }
}
