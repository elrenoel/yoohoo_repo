import { getPublicProfile } from "@/lib/profile-server";
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/profile-validation";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  const { username: raw } = await context.params;
  const username = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(username)) return Response.json({ error: "Profil tidak ditemukan." }, { status: 404 });
  const profile = await getPublicProfile(username);
  if (!profile) return Response.json({ error: "Profil tidak ditemukan." }, { status: 404 });
  const publicProfile = {
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    createdAt: profile.createdAt,
    counts: profile.counts,
    publicDecks: profile.publicDecks,
    posts: profile.posts,
  };
  return Response.json({ profile: publicProfile }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
}
