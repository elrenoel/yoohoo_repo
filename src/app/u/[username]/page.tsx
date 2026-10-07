import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import PublicProfileView from "@/components/profile/PublicProfileView";
import { getIsFollowing, getOwnerDrafts, getPublicProfile } from "@/lib/profile-server";
import { getSocialViewer } from "@/lib/social-guard";
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/profile-validation";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = await params;
  const username = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(username)) notFound();
  const [{ session }, profile] = await Promise.all([getSocialViewer(), getPublicProfile(username)]);
  if (!profile) notFound();
  const isOwner=session?.user.id===profile.userId;
  const [drafts,isFollowing]=await Promise.all([isOwner?getOwnerDrafts(profile.userId):Promise.resolve([]),getIsFollowing(session?.user.id,profile.userId)]);
  return <AppShell><PublicProfileView profile={profile} isOwner={isOwner} ownerDrafts={drafts} initialFollowing={isFollowing} /></AppShell>;
}
