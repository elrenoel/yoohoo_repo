"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Bell, Bookmark, Check, Info, Repeat2 } from "lucide-react";
import { useNotifications, useUnreadCount } from "@/hooks/use-notifications";
import { isSidebarItemActive } from "@/lib/sidebar-routes";

type NotificationRow = {
  id: string;
  type: string | null;
  link: string | null;
  severity: "info" | "success" | "error" | null;
  title: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

const severityStyles = {
  info: "border-border-strong bg-accent-subtle text-text-secondary",
  success: "border-success-border bg-success-subtle text-success-text",
  error: "border-danger-border bg-danger-subtle text-danger-text",
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

function timeAgo(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days} days ago`
    : new Date(value).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
      });
}

export default function NotificationBell() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { notifications, isLoading, markRead } = useNotifications({
    limit: 20,
    enabled: open,
  });
  const { unreadCount } = useUnreadCount();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list = notifications as NotificationRow[];
  const active = isSidebarItemActive("notifications", pathname);

  const show = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const hideSoon = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onFocus={show}
      onBlur={hideSoon}
    >
      <Link
        href="/notifications"
        aria-current={active ? "page" : undefined}
        className={`nav-focus relative flex items-center gap-4 px-3 py-3 text-[15px] transition ${active ? "font-bold text-accent" : "font-medium text-text-secondary hover:text-text"}`}
      >
        <Bell className="h-5 w-5 shrink-0" />
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-on-danger">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>

      {open && (
        <div className="absolute left-full top-0 z-50 ml-3 w-92 overflow-hidden rounded-2xl border border-border bg-surface shadow-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-text">
                Your Desk activity
              </h3>
            </div>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-accent hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="max-h-128 overflow-y-auto p-2">
            {isLoading ? (
              <div className="space-y-2 p-2">
                <div className="h-16 animate-pulse rounded-xl bg-skeleton" />
                <div className="h-16 animate-pulse rounded-xl bg-skeleton" />
              </div>
            ) : list.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bell className="mx-auto h-7 w-7 text-text-muted" />
                <p className="mt-2 text-xs text-text-secondary">No activity yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {list.map((notification) => {
                  const severity = notification.severity ?? "info";
                  const Icon = notification.type === "repost" || notification.type === "save"
                    ? interactionIcons[notification.type]
                    : severityIcons[severity];
                  const iconStyle = notification.type === "repost" || notification.type === "save"
                    ? interactionStyles[notification.type]
                    : severityStyles[severity];
                  return (
                    <Link
                      key={notification.id}
                      href={
                        notification.link || `/notifications/${notification.id}`
                      }
                      onClick={() => {
                        setOpen(false);
                        if (!notification.read_at)
                          void markRead(notification.id);
                      }}
                      className={`flex gap-3 rounded-xl border p-3 transition hover:border-border-strong hover:bg-surface-hover ${notification.read_at ? "border-transparent bg-surface" : "border-border bg-surface-raised"}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${iconStyle}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="line-clamp-1 flex-1 text-xs font-semibold text-text">
                            {notification.title || "Notification"}
                          </span>
                          {!notification.read_at && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger" />
                          )}
                        </span>
                        {notification.body && (
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-text-secondary">
                            {notification.body}
                          </span>
                        )}
                        <span className="mt-1 block text-[10px] text-text-muted">
                          {timeAgo(notification.created_at)}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
