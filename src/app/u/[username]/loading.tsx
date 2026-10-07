import AppShell from "@/components/layout/AppShell";

export default function PublicProfileLoading() {
  return <AppShell><main className="min-h-screen bg-[#F5F6F3] px-4 py-12"><div className="mx-auto max-w-5xl animate-pulse"><div className="border border-[#D8DCD3] bg-white p-10"><div className="flex gap-5"><div className="h-20 w-20 rounded-full bg-[#E4E7E1]" /><div className="flex-1"><div className="h-9 w-64 bg-[#E4E7E1]" /><div className="mt-3 h-4 w-28 bg-[#E4E7E1]" /><div className="mt-6 h-4 w-3/4 bg-[#E4E7E1]" /></div></div><div className="mt-8 h-20 bg-[#E4E7E1]" /></div><div className="mt-8 h-72 border border-[#D8DCD3] bg-white" /></div></main></AppShell>;
}
