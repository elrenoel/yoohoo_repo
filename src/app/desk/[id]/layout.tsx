"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";

export default function DeskLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  if (searchParams.get("share") === "1") return children;
  return <AppShell>{children}</AppShell>;
}
