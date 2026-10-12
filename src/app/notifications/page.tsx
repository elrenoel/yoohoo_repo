"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/lib/session-provider";
import { useToast } from "@/lib/toast";
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  Info,
  ArrowUpRight,
  Bookmark,
  Repeat2,
} from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

const severityStyles = {
  info: "bg-accent-subtle text-text-secondary border-border-strong",
  success: "bg-success-subtle text-success-text border-success-border",
  error: "bg-danger-subtle text-danger-text border-danger-border",
} as const;

const severityIcons = {
  info: Info,
  success: Check,
  error: AlertTriangle,
} as const;

const interactionIcons = { repost: Repeat2, save: Bookmark } as const;
const interactionStyles = {
  repost: "border-accent bg-accent-subtle text-accent",
  save: "border-success-border bg-success-subtle text-success-text",
} as const;

type NotificationRow = {
  id: string;
  type: string | null;
  severity: "info" | "success" | "error" | null;
  title: string | null;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

function NotificationItem({
  notification,
  onNotificationClick,
}: {
  notification: NotificationRow;
  onNotificationClick: (notification: NotificationRow) => void;
}) {
  const severity = notification.severity || "info";
  const Icon = notification.type === "repost" || notification.type === "save"
    ? interactionIcons[notification.type]
    : severityIcons[severity as keyof typeof severityIcons] || Info;
  const iconStyle = notification.type === "repost" || notification.type === "save"
    ? interactionStyles[notification.type]
    : severityStyles[severity as keyof typeof severityStyles];
  const isRead = !!notification.read_at;

  return (
    <Link
      href={notification.link || `/notifications/${notification.id}`}
      onClick={() => onNotificationClick(notification)}
      className={`flex gap-3 rounded-xl border p-4 transition ${
        isRead
          ? "border-border bg-surface/50 hover:bg-surface"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconStyle}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`text-sm font-semibold ${isRead ? "text-text-secondary" : "text-text"}`}
          >
            {notification.title || "Notification"}
          </h4>
          {!isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger" />}
        </div>
        {notification.body && (
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            {notification.body}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-text-muted">
          <Bell className="h-3 w-3" />
          <span>{timeAgo(notification.created_at)}</span>
        </div>
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-text-secondary">
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export default function NotificationsPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const { t } = toast;
  const [visibleCount, setVisibleCount] = useState(10);

  const { notifications, unreadCount, isLoading, markRead, markAllRead } =
    useNotifications({ limit: 20 });

  function handleNotificationClick(notification: NotificationRow) {
    if (!notification.read_at) {
      void markRead(notification.id);
    }
  }

  function handleMarkAllRead() {
    void markAllRead().then(success => { if (success) toast.success("All notifications marked as read."); });
  }

  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5">
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <Bell className="mx-auto h-10 w-10 text-text-muted" />
          <h2 className="mt-4 font-semibold">Notifications</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Log in to view your notifications.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex rounded-xl bg-action-primary px-4 py-2.5 text-sm font-medium text-on-action-primary"
          >
            Log in now
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg px-5 py-10 pb-28 text-text sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary">
              NOTIFICATIONS
            </p>
            <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {unreadCount === 0
                ? "You're all caught up."
                : `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}.`}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-action-primary px-4 py-2.5 text-sm font-medium text-on-action-primary transition hover:bg-action-primary-hover"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </button>
          )}
        </header>

        {isLoading ? (
          <div className="space-y-3" role="status">
            <span className="sr-only">{t("toast.desk.loading")}</span>
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-border bg-surface/50 p-4 animate-pulse"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded bg-skeleton w-2/3" />
                  <div className="h-3 rounded bg-skeleton w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface/40 px-6 py-12 text-center">
            <Bell className="h-10 w-10 text-text-muted" />
            <h2 className="mt-4 font-semibold">No notifications yet</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Study activity and social interactions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, visibleCount).map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNotificationClick={handleNotificationClick}
              />
            ))}
            {visibleCount < notifications.length && (
              <div className="flex justify-center pt-5">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 10)}
                  className="rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-surface-hover"
                >
                  Show more
                </button>
              </div>
            )}
            {notifications.length === 0 && unreadCount === 0 && (
              <div className="text-center py-8 text-sm text-text-secondary">
                There are no notifications to display yet.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
