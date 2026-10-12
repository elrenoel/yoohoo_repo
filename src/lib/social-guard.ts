import "server-only";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { getOwnProfile } from "@/lib/profile-server";

export async function getSocialViewer() {
  const session = await getServerSession();
  if (!session?.user) return { session: null, profile: null };
  const profile = await getOwnProfile(session.user.id);
  if (!profile) redirect("/onboarding/username");
  return { session, profile };
}
