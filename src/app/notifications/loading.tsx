export default function NotificationsLoading() {
  return <main className="min-h-screen bg-bg px-5 py-9"><div className="mx-auto max-w-4xl animate-pulse"><div className="h-10 w-56 rounded bg-skeleton"/><div className="mt-6 space-y-3">{[1,2,3,4,5].map(item=><div key={item} className="h-24 rounded-xl border border-border bg-skeleton"/>)}</div></div></main>;
}
