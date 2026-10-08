import { Suspense } from "react";
import ExploreBrowser from "@/components/explore/ExploreBrowser";
import AppShell from "@/components/layout/AppShell";
import { getSocialViewer } from "@/lib/social-guard";
export default async function ExplorePage() {
  await getSocialViewer();
  return <AppShell><Suspense fallback={<ExplorePageSkeleton />}><ExploreBrowser /></Suspense></AppShell>;
}
function ExplorePageSkeleton() {
  return <main className="min-h-screen bg-[#F5F6F3] px-8 py-5">
    <div className="flex gap-8 animate-pulse">
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[900px]">
          <div className="flex gap-2">{[80,110,90,105,120,85].map((width,index)=><div key={index} className="h-8 rounded-lg bg-[#E1E5DF]" style={{width}} />)}</div>
          <div className="mx-auto mt-5 w-full max-w-[720px] xl:min-w-[720px]">
            <div className="h-80 rounded-2xl bg-[#E1E5DF]" />
            {[1,2,3].map(item=><div key={item} className="mt-5 h-24 border-b border-[#D8DCD3] bg-[#E8EAE5]" />)}
          </div>
        </div>
      </div>
      <aside className="hidden w-[330px] shrink-0 space-y-4 xl:block">
        <div className="h-12 rounded-xl bg-[#E1E5DF]" />
        <div className="h-44 rounded-xl bg-[#E1E5DF]" />
        <div className="h-72 rounded-xl bg-[#E1E5DF]" />
      </aside>
    </div>
  </main>;
}
