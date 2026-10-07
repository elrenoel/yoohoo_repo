"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/session-provider";

// Hooks untuk berinteraksi dengan API notifikasi

export function useNotifications(options?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) {
  const { data: session } = useSession();

  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.notifications(options?.unreadOnly ? "unread" : "all", options?.limit, options?.offset),
    queryFn: async () => {
      if (!session?.user) return { notifications: [], total: 0, unreadCount: 0 };

      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", options.limit.toString());
      if (options?.offset) params.set("offset", options.offset.toString());
      if (options?.unreadOnly) params.set("unread", "true");

      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error("Gagal memuat notifikasi");

      const raw = (await response.json()) as {
        notifications?: unknown;
        total?: unknown;
        unreadCount?: unknown;
      } | null;

      if (!raw || !Array.isArray(raw.notifications)) {
        return { notifications: [], total: 0, unreadCount: 0 };
      }

      return {
        notifications: raw.notifications,
        total: Number(raw.total) || 0,
        unreadCount: Number(raw.unreadCount) || 0,
      };
    },
    enabled: !!session?.user,
    refetchInterval: (query) => {
      // Polling lebih agresif (5-10 detik) hanya jika ada job running
      const notifications = Array.isArray(query.state.data?.notifications)
        ? query.state.data.notifications
        : [];
      const hasRunningJob = notifications.some(
        (n) => n.type === "running" && !n.read_at
      );

      return hasRunningJob ? 5000 : 30000;
    },
    refetchIntervalInBackground: false,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId?: string) => {
      if (!session?.user) throw new Error("Anda harus login terlebih dahulu");
      
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      
      if (!response.ok) throw new Error("Gagal menandai notifikasi sebagai sudah dibaca");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user) throw new Error("Anda harus login terlebih dahulu");
      
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) throw new Error("Gagal menandai semua notifikasi sebagai sudah dibaca");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  return {
    notifications: query.data?.notifications ?? [],
    total: query.data?.total ?? 0,
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
  };
}

export function useUnreadCount() {
  const { data: session } = useSession();

  const query = useQuery({
    queryKey: ["unreadCount", session?.user?.id],
    queryFn: async () => {
      if (!session?.user) return 0;
      
      const response = await fetch(`/api/notifications/unread-count`);
      if (!response.ok) throw new Error("Gagal menghitung notifikasi belum dibaca");
      const data = await response.json();
      return data.unreadCount ?? 0;
    },
    enabled: !!session?.user,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  return {
    unreadCount: query.data ?? 0,
    isLoading: query.isLoading,
  };
}
