"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/session-provider";
import { useToast } from "@/lib/toast";

export type NotificationCacheItem = { id: string; read_at: string | null; [key: string]: unknown };
type NotificationCache = { notifications: NotificationCacheItem[]; total: number; unreadCount: number };
type ItemRollback = { marker: string; entries: Array<{ key: QueryKey; previousReadAt: string | null }> };
type AllRollback = { marker: string; entries: Array<{ key: QueryKey; previous: Map<string, string | null> }> };

// Hooks untuk berinteraksi dengan API notifikasi

export function useNotifications(options?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  enabled?: boolean;
}) {
  const { data: session } = useSession();

  const queryClient = useQueryClient();
  const toast = useToast();
  const markAllPromise = useRef<Promise<boolean> | null>(null);

  const query = useQuery({
    queryKey: queryKeys.notifications(session?.user?.id, options?.unreadOnly ? "unread" : "all", options?.limit ?? 20, options?.offset),
    queryFn: async () => {
      if (!session?.user) return { notifications: [], total: 0, unreadCount: 0 };

      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", options.limit.toString());
      if (options?.offset) params.set("offset", options.offset.toString());
      if (options?.unreadOnly) params.set("unread", "true");

      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error("Could not load notifications.");

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
        total: Number(raw.total) || raw.notifications.length,
        unreadCount: Number(raw.unreadCount) || 0,
      };
    },
    enabled: !!session?.user && (options?.enabled ?? true),
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  const markReadMutation = useMutation<unknown, Error, string, ItemRollback>({
    mutationFn: async (notificationId: string) => {
      if (!session?.user) throw new Error("You must be logged in.");
      
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      
      if (!response.ok) throw new Error("Could not mark the notification as read.");
      return response.json();
    },
    onMutate: (notificationId) => {
      const marker = new Date().toISOString();
      const entries: ItemRollback["entries"] = [];
      let wasUnread = false;
      for (const [key, cached] of queryClient.getQueriesData<NotificationCache>({ queryKey: ["notifications"] })) {
        const item = cached?.notifications.find(notification => notification.id === notificationId);
        if (!item) continue;
        entries.push({ key, previousReadAt: item.read_at });
        wasUnread ||= item.read_at === null;
        queryClient.setQueryData<NotificationCache>(key, current => current ? { ...current, notifications: current.notifications.map(notification => notification.id === notificationId && notification.read_at === null ? { ...notification, read_at: marker } : notification), unreadCount: Math.max(0, current.unreadCount - (item.read_at === null ? 1 : 0)) } : current);
      }
      if (wasUnread) queryClient.setQueriesData<number>({ queryKey: ["unread-count", session?.user?.id ?? "guest"] }, current => Math.max(0, (current ?? 0) - 1));
      return { marker, entries };
    },
    onError: (_error, notificationId, context) => {
      let restoredUnread = false;
      for (const entry of context?.entries ?? []) {
        queryClient.setQueryData<NotificationCache>(entry.key, current => {
          if (!current) return current;
          let restoredHere = false;
          const notifications = current.notifications.map(notification => {
            if (notification.id !== notificationId || notification.read_at !== context?.marker) return notification;
            restoredHere = entry.previousReadAt === null;
            restoredUnread ||= restoredHere;
            return { ...notification, read_at: entry.previousReadAt };
          });
          return { ...current, notifications, unreadCount: current.unreadCount + (restoredHere ? 1 : 0) };
        });
      }
      if (restoredUnread) queryClient.setQueriesData<number>({ queryKey: ["unread-count", session?.user?.id ?? "guest"] }, current => (current ?? 0) + 1);
      toast.error("Something went wrong. Try again.");
    },
  });

  const markAllReadMutation = useMutation<unknown, Error, void, AllRollback>({
    mutationFn: async () => {
      if (!session?.user) throw new Error("You must be logged in.");
      
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) throw new Error("Could not mark all notifications as read.");
      return response.json();
    },
    onMutate: () => {
      const marker = new Date().toISOString();
      const entries: AllRollback["entries"] = [];
      for (const [key, cached] of queryClient.getQueriesData<NotificationCache>({ queryKey: ["notifications"] })) {
        if (!cached) continue;
        entries.push({ key, previous: new Map(cached.notifications.map(notification => [notification.id, notification.read_at])) });
        queryClient.setQueryData<NotificationCache>(key, { ...cached, notifications: cached.notifications.map(notification => notification.read_at === null ? { ...notification, read_at: marker } : notification), unreadCount: 0 });
      }
      queryClient.setQueriesData<number>({ queryKey: ["unread-count", session?.user?.id ?? "guest"] }, 0);
      return { marker, entries };
    },
    onError: (_error, _variables, context) => {
      const restoredIds = new Set<string>();
      for (const entry of context?.entries ?? []) {
        queryClient.setQueryData<NotificationCache>(entry.key, current => {
          if (!current) return current;
          const notifications = current.notifications.map(notification => {
            const previous = entry.previous.get(notification.id);
            if (notification.read_at !== context?.marker || previous === undefined) return notification;
            if (previous === null) restoredIds.add(notification.id);
            return { ...notification, read_at: previous };
          });
          const unreadCount = notifications.reduce((count, notification) => count + (notification.read_at === null ? 1 : 0), 0);
          return { ...current, notifications, unreadCount };
        });
      }
      if (restoredIds.size) queryClient.setQueriesData<number>({ queryKey: ["unread-count", session?.user?.id ?? "guest"] }, current => (current ?? 0) + restoredIds.size);
      toast.error("Something went wrong. Try again.");
    },
  });

  const markAllRead = () => {
    if (markAllPromise.current) return markAllPromise.current;
    const promise = markAllReadMutation.mutateAsync().then(() => true).catch(() => false).finally(() => {
      if (markAllPromise.current === promise) markAllPromise.current = null;
    });
    markAllPromise.current = promise;
    return promise;
  };

  return {
    notifications: query.data?.notifications ?? [],
    total: query.data?.total ?? 0,
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    markRead: (notificationId: string) => markReadMutation.mutateAsync(notificationId).catch(() => undefined),
    markAllRead,
  };
}

export function useUnreadCount() {
  const { data: session } = useSession();

  const query = useQuery({
    queryKey: queryKeys.unreadCount(session?.user?.id),
    queryFn: async () => {
      if (!session?.user) return 0;
      
      const response = await fetch(`/api/notifications/unread-count`);
      if (!response.ok) throw new Error("Could not load the unread notification count.");
      const data = await response.json();
      return data.unreadCount ?? 0;
    },
    enabled: !!session?.user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  return {
    unreadCount: query.data ?? 0,
    isLoading: query.isLoading,
  };
}
