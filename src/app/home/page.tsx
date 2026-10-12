import HomeFeed from "@/components/feed/HomeFeed";
import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";
export default async function HomePage() {
  const session=await getServerSession();
  if(!session)redirect("/login");
  return <HomeFeed />;
}
