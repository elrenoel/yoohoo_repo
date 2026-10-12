export default function SavedLoading() {
  return <main className="min-h-screen bg-bg px-5 py-9"><div className="mx-auto max-w-4xl animate-pulse"><div className="h-3 w-24 rounded bg-skeleton"/><div className="mt-3 h-10 w-48 rounded bg-skeleton"/><div className="mt-7 h-12 w-48 rounded-xl bg-skeleton"/><div className="mt-6 space-y-3">{[1,2,3,4].map(item=><div key={item} className="h-24 rounded-xl border border-border bg-skeleton"/>)}</div></div></main>;
}
