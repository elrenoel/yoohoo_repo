import { Suspense } from "react";
import ExploreBrowser from "@/components/explore/ExploreBrowser";
import AppShell from "@/components/layout/AppShell";
export default function ExplorePage() {
  return <AppShell><Suspense fallback={<ExplorePageSkeleton />}><ExploreBrowser /></Suspense></AppShell>;
}
function ExplorePageSkeleton() {
  return <main className="min-h-screen bg-bg">
    <div className="border-b border-border px-4 py-3 sm:px-6 lg:px-8"><div className="flex gap-2 overflow-hidden animate-pulse">{[36,80,110,90,105,120,85,100].map((width,index)=><div key={index} className="h-9 shrink-0 rounded-lg bg-skeleton" style={{width}} />)}</div></div>
    <div className="flex gap-8 px-4 py-5 sm:px-6 lg:px-8 animate-pulse">
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[900px]">
          <div className="mx-auto w-full max-w-[720px] xl:min-w-[720px]">
            <div className="h-80 rounded-2xl bg-skeleton" />
            {[1,2,3].map(item=><div key={item} className="mt-5 h-24 border-b border-border bg-surface-subtle" />)}
          </div>
        </div>
      </div>
      <aside className="hidden w-[330px] shrink-0 space-y-4 xl:block">
        <div className="h-12 rounded-xl bg-skeleton" />
        <div className="h-44 rounded-xl bg-skeleton" />
        <div className="h-72 rounded-xl bg-skeleton" />
      </aside>
    </div>
  </main>;
}
