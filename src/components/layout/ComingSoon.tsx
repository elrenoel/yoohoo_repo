import AppShell from "@/components/layout/AppShell";

export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return <AppShell><div className="min-h-screen bg-[#fafafa] text-neutral-900"><main className="flex min-h-[70vh] items-center justify-center px-6 py-16 pb-24 lg:pb-16"><div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-xs"><div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-[#e4f0e8]" /><h1 className="text-2xl font-semibold text-[#013528]">{title}</h1><p className="mt-2 text-sm text-neutral-500">{description}</p><p className="mt-6 text-xs font-mono uppercase tracking-wider text-neutral-400">Segera hadir</p></div></main></div></AppShell>;
}
