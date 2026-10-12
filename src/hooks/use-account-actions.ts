"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth-client";
import { useSession } from "@/lib/session-provider";

/** Shared authenticated-account state used by the app shell and public header. */
export function useAccountActions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending: isSessionPending, invalidate } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      const result = await signOut();
      if (result?.error) {
        throw new Error(result.error.message || "Sign out failed");
      }
      queryClient.clear();
      invalidate();
      // A hard navigation guarantees the Better Auth cookie and server layout
      // are re-read instead of leaving stale session UI mounted.
      window.location.replace("/login");
    } catch (error) {
      console.error("Sign out failed", error);
      queryClient.setQueryData(["better-auth-session"], null);
      invalidate();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }, [invalidate, queryClient, router]);

  return { session, isSessionPending, handleLogout, isLoggingOut };
}
