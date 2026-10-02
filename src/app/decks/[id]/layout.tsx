import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";

export default function DeckLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
