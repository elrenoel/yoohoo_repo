import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export default function ProfileNotFound() {
  return <AppShell><main className="flex min-h-screen items-center justify-center bg-canvas-soft px-5 text-text"><div className="max-w-md border border-border bg-surface p-10 text-center"><div className="font-mono text-xs uppercase tracking-[0.2em] text-danger-text">404</div><h1 className="mt-3 font-serif text-3xl font-semibold">Profile not found</h1><p className="mt-3 text-sm leading-6 text-text-secondary">This username is not registered or is no longer available.</p><Link href="/explore" className="mt-7 inline-flex rounded-lg bg-action-primary px-5 py-3 text-sm font-semibold text-on-action-primary">Back to Explore</Link></div></main></AppShell>;
}
