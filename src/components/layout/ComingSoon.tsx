import AppShell from "@/components/layout/AppShell";

export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return <AppShell><div className="min-h-screen bg-bg text-text"><main className="flex min-h-[70vh] items-center justify-center px-6 py-16 pb-24 lg:pb-16"><div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-10 text-center shadow-none"><div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-accent-subtle" /><h1 className="text-2xl font-semibold text-accent">{title}</h1><p className="mt-2 text-sm text-text-secondary">{description}</p><p className="mt-6 font-mono text-xs uppercase tracking-wider text-text-muted">Segera hadir</p></div></main></div></AppShell>;
}
