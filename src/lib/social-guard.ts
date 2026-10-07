import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOwnProfile } from "@/lib/profile-server";

export async function getSocialViewer() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { session: null, profile: null };
  const profile = await getOwnProfile(session.user.id);
  if (!profile) redirect("/onboarding/username");
  return { session, profile };
}
