"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session-provider";
import { useLanguage } from "@/hooks/use-language";
import { signOut } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export interface NavbarNavLink {
  href: string;
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
}

export interface QuotaInfo {
  remainingToday: number;
  usedToday: number;
  dailyLimit: number;
}

export interface UseNavbarReturn {
  /** Current session data (null if not logged in or loading) */
  session: ReturnType<typeof useSession>["data"];
  /** Whether session is still loading */
  isSessionPending: boolean;
  /** Navigation links for logged-in users */
  navLinks: NavbarNavLink[];
  /** Daily generation quota (null if not logged in) */
  quota: QuotaInfo | null;
  /** Current language */
  lang: "id" | "en";
  /** Translation function */
  t: ReturnType<typeof useLanguage>["t"];
  /** Logout handler (calls signOut, invalidates session, redirects) */
  handleLogout: () => Promise<void>;
  /** Whether logout is in progress */
  isLoggingOut: boolean;
  /** Current pathname */
  pathname: string;
}

/**
 * Custom hook that encapsulates all logic needed by the Navbar.
 * Components just render data from this hook — no inline logic.
 */
export function useNavbar(): UseNavbarReturn {
  const pathname = usePathname();
  const router = useRouter();
  const {
    data: session,
    isPending: isSessionPending,
    invalidate: invalidateSession,
  } = useSession();
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ── Navigation links (visible when logged in) ──────────────────────────
  const navLinks: NavbarNavLink[] = [
    {
      href: "/app",
      label: t("error.home"),
      isActive: pathname === "/app",
    },
    {
      href: "/history",
      label: t("nav.history"),
      isActive: pathname === "/history",
    },
  ];

  // ── Daily quota (only fetched when logged in) ─────────────────────────
  const { data: quotaData } = useQuery<{
    remainingToday: number;
    usedToday: number;
    dailyLimit: number;
  } | null>({
    queryKey: queryKeys.quota,
    queryFn: async () => {
      const res = await fetch("/api/documents/generate");
      const data = await res.json();
      if (typeof data.remainingToday === "number") {
        return {
          remainingToday: data.remainingToday,
          usedToday: data.usedToday ?? 0,
          dailyLimit: data.dailyLimit ?? 5,
        };
      }
      return null;
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000,
  });

  const quota = quotaData ?? null;

  // ── Logout handler ────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      // Immediately clear the session from cache so landing page won't redirect back
      queryClient.setQueryData(["better-auth-session"], null);
      invalidateSession();
      router.push("/");
    } catch {
      // Ignored — signOut is best-effort
    } finally {
      setIsLoggingOut(false);
    }
  }, [invalidateSession, router]);

  return {
    session,
    isSessionPending,
    navLinks,
    quota,
    lang,
    t,
    handleLogout,
    isLoggingOut,
    pathname,
  };
}
