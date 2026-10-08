"use client";

import Image from "next/image";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#F5F6F3] px-6 text-center text-[#16241D]">
    <div className="w-full max-w-md">
      <Image src="/error-mascot.svg" alt="A surprised Yoohoo mascot" width={320} height={230} priority className="mx-auto h-auto w-full max-w-[300px]" />
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-[#6B7971]">We couldn&apos;t load this page. Please try again.</p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={reset} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-full bg-[#164C3D] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#205E4A]"><RefreshCw className="h-4 w-4" />Retry</button>
        <Link href="/home" className="inline-flex min-w-32 items-center justify-center rounded-full border border-[#CAD1C9] bg-white px-6 py-3 text-sm font-semibold text-[#44534B] transition hover:bg-[#EDF1EB]">Back home</Link>
      </div>
    </div>
  </main>;
}
