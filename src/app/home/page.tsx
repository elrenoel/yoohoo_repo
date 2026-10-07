import HomeFeed from "@/components/feed/HomeFeed";
import { getSocialViewer } from "@/lib/social-guard";
import { redirect } from "next/navigation";
export default async function HomePage() {
  const {session}=await getSocialViewer();
  if(!session)redirect("/login");
  return <HomeFeed />;
}
