"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session-provider";
import type { OwnProfile } from "@/lib/profile-server";

export function useOwnProfile() {
  const { data: session, isPending: sessionPending } = useSession();
  const query = useQuery<{ profile: OwnProfile | null }>({
    queryKey: ["own-profile", session?.user.id],
    queryFn: async () => {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) throw new Error("Gagal memuat profil.");
      return response.json() as Promise<{ profile: OwnProfile | null }>;
    },
    enabled: Boolean(session?.user),
    staleTime: 5 * 60_000,
  });
  return { ...query, isPending: sessionPending || query.isPending };
}
