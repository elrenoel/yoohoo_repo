"use client";

import AppShell from "@/components/layout/AppShell";
import SavedItems from "@/components/social/SavedItems";

export default function SavedPage() {
  return <AppShell><main className="min-h-screen bg-bg px-5 py-9 text-text"><div className="mx-auto max-w-4xl"><p className="font-mono text-xs uppercase tracking-[.2em] text-text-secondary">COLLECTION</p><h1 className="mt-2 font-serif text-4xl font-semibold">Saved</h1><SavedItems /></div></main></AppShell>;
}
