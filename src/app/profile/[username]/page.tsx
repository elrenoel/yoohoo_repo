import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ProfilePageView from "@/components/profile/ProfilePageView";
import { getIsFollowing, getPublicProfile } from "@/lib/profile-server";
import { getSocialViewer } from "@/lib/social-guard";
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/profile-validation";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = await params;
  const username = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(username)) notFound();
  const { session } = await getSocialViewer();
  const profile = await getPublicProfile(username, session?.user.id);
  if (!profile) notFound();
  const isOwner=session?.user.id===profile.userId;
  const isFollowing=await getIsFollowing(session?.user.id,profile.userId);
  return <AppShell><ProfilePageView profile={profile} isOwner={isOwner} initialFollowing={isFollowing} /></AppShell>;
}
