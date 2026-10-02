"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookMarked,
  Compass,
  FilePlus2,
  Home,
  History,
  LogOut,
  MoreHorizontal,
  Settings,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useAccountActions } from "@/hooks/use-account-actions";
import { useLanguage } from "@/hooks/use-language";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

type NavigationItem = { href: string; label: string; icon: LucideIcon };

const discovery: NavigationItem[] = [
  { href: "/home", label: "Beranda", icon: Home },
  { href: "/explore", label: "Jelajah", icon: Compass },
];

const workspace: NavigationItem[] = [
  { href: "/desk", label: "Your Desk", icon: FilePlus2 },
  { href: "/history", label: "Riwayat", icon: History },
  { href: "/saved", label: "Tersimpan", icon: BookMarked },
  { href: "/starred", label: "Ditandai", icon: Star },
];

const identity: NavigationItem[] = [
  { href: "/notifications", label: "Notifikasi", icon: Bell },
  { href: "/profile", label: "Profil", icon: User },
];

function NavItem({
  item,
  onClick,
  compact = false,
}: {
  item: NavigationItem;
  onClick?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active =
    pathname === item.href ||
    (item.href !== "/home" && pathname.startsWith(`${item.href}/`));
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex rounded-xl transition ${compact ? "flex-col items-center gap-0.5 px-2 py-1 text-[10px]" : "items-center gap-3 px-3 py-2.5 text-sm"} ${active ? "bg-[#e4f0e8] font-semibold text-[#013528]" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

const moreItems: NavigationItem[] = [
  ...workspace.slice(2),
  identity[0],
  { href: "/settings", label: "Pengaturan", icon: Settings },
  { href: "/trash", label: "Sampah", icon: Trash2 },
];

export default function SidebarNav() {
  const { session, handleLogout, isLoggingOut } = useAccountActions();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node))
        setMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  if (!session?.user) return null;

  const userName = session.user.name || session.user.email;

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-neutral-200 bg-white px-4 py-5 lg:flex">
        <Link href="/home" className="mb-8 flex items-center gap-2 px-2">
          <Image
            src="/logo_yoohoo.png"
            alt="Yoohoo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg"
          />
        </Link>

        <nav
          className="flex min-h-0 flex-1 flex-col gap-1"
          aria-label="Navigasi utama"
        >
          {discovery.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
          <div className="my-4 h-px bg-neutral-200" />
          {workspace.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
          <div className="my-4 h-px bg-neutral-200" />
          {identity.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}

          <div className="mt-auto border-t border-neutral-200 pt-4">
            <Link
              href="/profile"
              className="mb-3 flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-neutral-100"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e4f0e8] text-[#013528]">
                <User className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-neutral-900">
                  {userName}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {session.user.email}
                </p>
              </div>
            </Link>
            <LanguageSwitcher mobile />
            <Link
              href="/settings"
              className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              <Settings className="h-4 w-4" aria-hidden="true" /> Pengaturan
            </Link>
            <Link
              href="/trash"
              className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Sampah
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
              title={t("nav.logoutTitle")}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {isLoggingOut ? "Keluar..." : t("nav.logout")}
            </button>
          </div>
        </nav>
      </aside>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-neutral-200 bg-white px-2 py-2 lg:hidden"
        aria-label="Navigasi mobile"
      >
        {[...discovery, workspace[0], workspace[1], identity[1]].map((item) => (
          <NavItem key={item.href} item={item} compact />
        ))}
        <div ref={moreRef} className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] transition ${moreOpen ? "bg-[#e4f0e8] text-[#013528]" : "text-neutral-500 hover:bg-neutral-100"}`}
          >
            {moreOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
            Lainnya
          </button>
          {moreOpen && (
            <div
              className="absolute bottom-14 right-0 w-56 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl"
              role="menu"
            >
              {moreItems.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  onClick={() => setMoreOpen(false)}
                />
              ))}
              <div className="my-2 h-px bg-neutral-100" />
              <LanguageSwitcher mobile />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  void handleLogout();
                }}
                disabled={isLoggingOut}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {isLoggingOut ? "Keluar..." : t("nav.logout")}
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
