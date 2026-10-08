import { redirect } from "next/navigation";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  redirect(`/profile/${username}`);
}
