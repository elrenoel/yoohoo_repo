"use client";

import Link from "next/link";
import { useSession } from "@/lib/session-provider";
import { useToast } from "@/lib/toast";
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

const severityStyles = {
  info: "bg-[#DDE9D4] text-[#516757] border-[#C5D2BE]",
  success: "bg-[#EEF5F0] text-[#2F7651] border-[#BFD6C4]",
  error: "bg-[#FBEDEB] text-[#C24A3D] border-[#F0C4BE]",
} as const;

const severityIcons = {
  info: Info,
  success: Check,
  error: AlertTriangle,
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

  if (seconds < 60) return "baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari yang lalu`;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function NotificationItem({
  notification,
  onNotificationClick,
}: {
  notification: NotificationRow;
  onNotificationClick: (notification: NotificationRow) => void;
}) {
  const severity = notification.severity || "info";
  const Icon = severityIcons[severity as keyof typeof severityIcons] || Info;
  const isRead = !!notification.read_at;

  return (
    <Link
      href={`/notifications/${notification.id}`}
      onClick={() => onNotificationClick(notification)}
      className={`flex gap-3 rounded-xl border p-4 transition ${
        isRead
          ? "border-neutral-200 bg-white/50 hover:bg-white"
          : "border-[#C9D2C8] bg-white hover:border-[#9EAE9E]"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${severityStyles[severity as keyof typeof severityStyles]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`text-sm font-semibold ${isRead ? "text-neutral-600" : "text-[#16241D]"}`}
          >
            {notification.title || "Notifikasi"}
          </h4>
          {!isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#C24A3D]" />}
        </div>
        {notification.body && (
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">
            {notification.body}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-500">
          <Bell className="h-3 w-3" />
          <span>{timeAgo(notification.created_at)}</span>
        </div>
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#DDE9D4] text-[#516757]">
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export default function NotificationsPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const { t } = toast;

  const { notifications, unreadCount, isLoading, markRead, markAllRead } =
    useNotifications();

  async function handleNotificationClick(notification: NotificationRow) {
    if (notification.link && !notification.read_at) {
      await markRead(notification.id);
    }
  }

  async function handleMarkAllRead() {
    await markAllRead();
    toast.success(t("toast.dismiss") + " Notifikasi");
  }

  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F6F3] px-5">
        <div className="rounded-xl border border-[#D8DCD3] bg-white p-8 text-center">
          <Bell className="mx-auto h-10 w-10 text-[#7A8780]" />
          <h2 className="mt-4 font-semibold">Notifikasi</h2>
          <p className="mt-1 text-sm text-[#5B6B62]">
            Silakan masuk untuk melihat notifikasi Anda.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex rounded-xl bg-[#013528] px-4 py-2.5 text-sm font-medium text-white"
          >
            Masuk sekarang
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F6F3] px-5 py-10 pb-28 text-[#16241D] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5B6B62]">
              NOTIFIKASI
            </p>
            <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">
              Notifikasi
            </h1>
            <p className="mt-1 text-sm text-[#5B6B62]">
              {unreadCount === 0
                ? "Semua notifikasi sudah kamu baca."
                : `${unreadCount} notifikasi belum dibaca.`}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#123F34] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#244E3D]"
            >
              <CheckCheck className="h-4 w-4" />
              Tandai semua dibaca
            </button>
          )}
        </header>

        {isLoading ? (
          <div className="space-y-3" role="status">
            <span className="sr-only">{t("toast.desk.loading")}</span>
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-[#D8DCD3] bg-white/50 p-4 animate-pulse"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E6EADF]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded bg-[#E6EADF] w-2/3" />
                  <div className="h-3 rounded bg-[#E6EADF] w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#C8CDC4] bg-white/40 px-6 py-12 text-center">
            <Bell className="h-10 w-10 text-[#A4ADA6]" />
            <h2 className="mt-4 font-semibold">Tidak ada notifikasi</h2>
            <p className="mt-1 text-sm text-[#5B6B62]">
              Notifikasi muncul saat ada perubahan status job.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNotificationClick={handleNotificationClick}
              />
            ))}
            {notifications.length === 0 && unreadCount === 0 && (
              <div className="text-center py-8 text-sm text-[#5B6B62]">
                Belum ada notifikasi untuk ditampilkan.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
