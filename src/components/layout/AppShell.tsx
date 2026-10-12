"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession } from "@/lib/session-provider";
import SidebarNav from "@/components/layout/SidebarNav";
import { usePathname } from "next/navigation";

const AppShellContext = createContext(false);

/** Layout for authenticated app routes: sidebar on desktop, bottom nav on mobile. */
export default function AppShell({ children, root = false }: { children: ReactNode; root?: boolean }) {
  const insideShell = useContext(AppShellContext);
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
  const appRoute = /^\/(home|explore|saved|desk|decks|notifications|profile|u|p|settings|trash|tulis)(\/|$)/.test(pathname);
  const showNavigation = appRoute && !isPending && Boolean(session?.user);

  if (insideShell && !root) return children;

  return (
    <AppShellContext.Provider value>
      <div className="min-h-screen bg-bg text-text">
        {showNavigation && <SidebarNav />}
        <div className={showNavigation ? "min-h-screen bg-bg pb-20 lg:ml-60 lg:pb-0" : "min-h-screen bg-bg"}>
          {children}
        </div>
      </div>
    </AppShellContext.Provider>
  );
}
