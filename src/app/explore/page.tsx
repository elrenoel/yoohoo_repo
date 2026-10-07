import { Suspense } from "react";
import ExploreBrowser from "@/components/explore/ExploreBrowser";
import AppShell from "@/components/layout/AppShell";
import { getSocialViewer } from "@/lib/social-guard";
export default async function ExplorePage() {
  await getSocialViewer();
  return <AppShell><Suspense fallback={<ExplorePageSkeleton />}><ExploreBrowser /></Suspense></AppShell>;
}
function ExplorePageSkeleton() { return <main className="min-h-screen bg-[#F5F6F3] px-5 py-9"><div className="mx-auto max-w-6xl animate-pulse"><div className="h-12 w-56 bg-[#E1E5DF]"/><div className="mt-8 h-16 bg-white"/><div className="mt-8 grid gap-4 md:grid-cols-2"><div className="h-52 bg-white"/><div className="h-52 bg-white"/></div></div></main> }
