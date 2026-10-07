import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export default function ProfileNotFound() {
  return <AppShell><main className="flex min-h-screen items-center justify-center bg-[#F5F6F3] px-5 text-[#16241D]"><div className="max-w-md border border-[#D8DCD3] bg-white p-10 text-center"><div className="font-mono text-xs uppercase tracking-[0.2em] text-[#C24A3D]">404</div><h1 className="mt-3 font-serif text-3xl font-semibold">Profil tidak ditemukan</h1><p className="mt-3 text-sm leading-6 text-[#5B6B62]">Username ini belum terdaftar atau sudah tidak tersedia.</p><Link href="/explore" className="mt-7 inline-flex rounded-lg bg-[#164C3D] px-5 py-3 text-sm font-semibold text-white">Kembali ke Jelajah</Link></div></main></AppShell>;
}
