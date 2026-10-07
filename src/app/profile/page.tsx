import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOwnProfile } from "@/lib/profile-server";

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const profile = await getOwnProfile(session.user.id);
  redirect(profile ? `/u/${profile.username}` : "/onboarding/username");
}
