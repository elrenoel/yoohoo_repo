"use client";

import type { ReactNode } from "react";
import { useSession } from "@/lib/session-provider";
import SidebarNav from "@/components/layout/SidebarNav";

/** Layout for authenticated app routes: sidebar on desktop, bottom nav on mobile. */
export default function AppShell({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const showNavigation = !isPending && Boolean(session?.user);

  return (
    <>
      {showNavigation && <SidebarNav />}
      <div className={showNavigation ? "min-h-screen pb-20 lg:ml-60 lg:pb-0" : "min-h-screen"}>
        {children}
      </div>
    </>
  );
}
