import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-center text-text">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">The page may have moved or no longer exists.</p>
        <Link href="/" className="mt-7 inline-flex rounded-full bg-action-primary px-6 py-3 text-sm font-semibold text-on-action-primary transition hover:bg-action-primary-hover">
          Back to Yoohoo
        </Link>
      </div>
    </main>
  );
}
