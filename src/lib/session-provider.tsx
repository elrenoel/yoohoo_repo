"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  generationCountToday?: number;
  lastGenerationDate?: string | null;
}

interface SessionData {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  user: SessionUser;
}

interface SessionContextValue {
  /** Session data (null if not logged in or still loading) */
  data: SessionData | null;
  /** True while the initial session fetch is in progress */
  isPending: boolean;
  /** Force-refetch the session (call after login/logout) */
  invalidate: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const {
    data: sessionData,
    isPending,
  } = useQuery<SessionData | null>({
    queryKey: ["better-auth-session"],
    queryFn: async () => {
      try {
        const result = await authClient.getSession();
        // authClient.getSession() returns { data, error }
        if (result.error || !result.data) return null;
        return result.data as SessionData;
      } catch {
        return null;
      }
    },
    // Fetch once, cache for 10 minutes
    staleTime: 10 * 60 * 1000,
    // Don't refetch on window focus — session is cookie-cached server-side
    refetchOnWindowFocus: false,
    // Don't refetch on mount if still fresh
    refetchOnMount: false,
    // Retry once on failure
    retry: 1,
    // Don't refetch when navigating between pages
    refetchOnReconnect: false,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["better-auth-session"] });
  }, [queryClient]);

  return (
    <SessionContext.Provider
      value={{
        data: sessionData ?? null,
        isPending,
        invalidate,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Access the current session from the SessionProvider.
 *
 * - `data` is null while loading or if the user is not logged in.
 * - `isPending` is true during the initial fetch.
 * - `invalidate()` forces a re-fetch (call after login/logout).
 */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within <SessionProvider>");
  }
  return ctx;
}
