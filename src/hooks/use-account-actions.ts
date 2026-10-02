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
      await signOut();
      queryClient.setQueryData(["better-auth-session"], null);
      invalidate();
      router.push("/");
    } catch {
      // Sign-out is best effort; the session query will be refreshed on navigation.
    } finally {
      setIsLoggingOut(false);
    }
  }, [invalidate, queryClient, router]);

  return { session, isSessionPending, handleLogout, isLoggingOut };
}
