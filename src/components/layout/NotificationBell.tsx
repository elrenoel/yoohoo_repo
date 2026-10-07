"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Bell, Check, Info } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

type NotificationRow = {
  id: string;
  severity: "info" | "success" | "error" | null;
  title: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

const severityStyles = {
  info: "border-[#C5D2BE] bg-[#DDE9D4] text-[#516757]",
  success: "border-[#BFD6C4] bg-[#EEF5F0] text-[#2F7651]",
  error: "border-[#F0C4BE] bg-[#FBEDEB] text-[#C24A3D]",
} as const;

const severityIcons = { info: Info, success: Check, error: AlertTriangle } as const;

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} hari lalu` : new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export default function NotificationBell() {
  const pathname = usePathname();
  const { notifications, unreadCount, isLoading, markRead } = useNotifications({ limit: 50 });
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list = notifications as NotificationRow[];
  const active = pathname.startsWith("/notifications");

  const show = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const hideSoon = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }, []);

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={hideSoon}>
      <Link
        href="/notifications"
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-[#e4f0e8] font-semibold text-[#013528]" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"}`}
      >
        <Bell className="h-4 w-4 shrink-0" />
        <span>Notifikasi</span>
        {unreadCount > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C24A3D] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>

      {open && (
        <div className="absolute left-full top-0 z-50 ml-3 w-[23rem] overflow-hidden rounded-2xl border border-[#D8DCD3] bg-white shadow-[0_18px_55px_rgba(22,36,29,0.18)]">
          <div className="flex items-center justify-between border-b border-[#E4E6DE] px-4 py-3">
            <div><h3 className="text-sm font-semibold text-[#16241D]">Aktivitas Your Desk</h3><p className="mt-0.5 text-[11px] text-[#6A776F]">{unreadCount} belum dibaca</p></div>
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-[#244E3D] hover:underline">Lihat semua</Link>
          </div>

          <div className="max-h-[32rem] overflow-y-auto p-2">
            {isLoading ? (
              <div className="space-y-2 p-2"><div className="h-16 animate-pulse rounded-xl bg-[#EFF1EB]" /><div className="h-16 animate-pulse rounded-xl bg-[#EFF1EB]" /></div>
            ) : list.length === 0 ? (
              <div className="px-5 py-10 text-center"><Bell className="mx-auto h-7 w-7 text-[#A4ADA6]" /><p className="mt-2 text-xs text-[#5B6B62]">Belum ada aktivitas.</p></div>
            ) : (
              <div className="space-y-1.5">
                {list.map(notification => {
                  const severity = notification.severity ?? "info";
                  const Icon = severityIcons[severity];
                  return (
                    <Link
                      key={notification.id}
                      href={`/notifications/${notification.id}`}
                      onClick={() => { setOpen(false); if (!notification.read_at) void markRead(notification.id); }}
                      className={`flex gap-3 rounded-xl border p-3 transition hover:border-[#AAB7AB] hover:bg-[#F7F8F5] ${notification.read_at ? "border-transparent bg-white" : "border-[#D8DCD3] bg-[#FCFBF7]"}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${severityStyles[severity]}`}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2"><span className="line-clamp-1 flex-1 text-xs font-semibold text-[#16241D]">{notification.title || "Notifikasi"}</span>{!notification.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#C24A3D]" />}</span>
                        {notification.body && <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-[#68746D]">{notification.body}</span>}
                        <span className="mt-1 block text-[10px] text-[#8A948E]">{timeAgo(notification.created_at)}</span>
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
