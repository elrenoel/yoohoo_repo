"use client";

import AppShell from "@/components/layout/AppShell";
import SavedItems from "@/components/social/SavedItems";

export default function SavedPage() {
  return <AppShell><main className="min-h-screen bg-[#F5F6F3] px-5 py-9 text-[#16241D]"><div className="mx-auto max-w-4xl"><p className="font-mono text-xs uppercase tracking-[.2em] text-[#5B6B62]">Koleksi</p><h1 className="mt-2 font-serif text-4xl font-semibold">Tersimpan</h1><SavedItems /></div></main></AppShell>;
}
