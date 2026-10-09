"use client";

import Image from "next/image";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-center text-text">
    <div className="w-full max-w-md">
      <Image src="/error-mascot.svg" alt="A surprised Yoohoo mascot" width={320} height={230} priority className="mx-auto h-auto w-full max-w-[300px]" />
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-text-secondary">We couldn&apos;t load this page. Please try again.</p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={reset} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-full bg-action-primary px-6 py-3 text-sm font-semibold text-on-action-primary transition hover:bg-action-primary-hover"><RefreshCw className="h-4 w-4" />Retry</button>
        <Link href="/home" className="inline-flex min-w-32 items-center justify-center rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-text-secondary transition hover:bg-surface-hover">Back home</Link>
      </div>
    </div>
  </main>;
}
