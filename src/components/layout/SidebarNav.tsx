"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookMarked,
  ChevronDown,
  Compass,
  FilePlus2,
  Home,
  LogOut,
  MoreHorizontal,
  PenLine,
  Settings,
  Trash2,
  User,
  X,
} from "lucide-react";

import NotificationBell from "./NotificationBell";
import { useAccountActions } from "@/hooks/use-account-actions";
import { useLanguage } from "@/hooks/use-language";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useOwnProfile } from "@/hooks/use-own-profile";
import { isSidebarItemActive, type SidebarItemId } from "@/lib/sidebar-routes";

type NavigationItem = { id: SidebarItemId; href: string; label: string; icon: LucideIcon };

const discovery: NavigationItem[] = [
  { id: "home", href: "/home", label: "Home", icon: Home },
  { id: "explore", href: "/explore", label: "Explore", icon: Compass },
];

const workspace: NavigationItem[] = [
  { id: "desk", href: "/desk", label: "Your Desk", icon: FilePlus2 },
  { id: "saved", href: "/saved", label: "Saved", icon: BookMarked },
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
  const active = isSidebarItemActive(item.id, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`nav-focus flex transition ${compact ? "flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px]" : "items-center gap-4 px-3 py-3 text-[15px]"} ${active ? "font-bold text-accent" : "font-medium text-text-secondary hover:text-text"}`}
    >
      <Icon className={compact ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

const moreItems: NavigationItem[] = [
  { id: "notifications", href: "/notifications", label: "Notifications", icon: Bell },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
  { id: "trash", href: "/trash", label: "Trash", icon: Trash2 },
];

export default function SidebarNav() {
  const { session, handleLogout, isLoggingOut } = useAccountActions();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);
  const desktopMoreRef = useRef<HTMLDivElement>(null);
  const { data: profileData } = useOwnProfile();

  useEffect(() => {
    if (!moreOpen && !createOpen && !desktopMoreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node))
        setMoreOpen(false);
      if (createRef.current && !createRef.current.contains(event.target as Node)) setCreateOpen(false);
      if (desktopMoreRef.current && !desktopMoreRef.current.contains(event.target as Node)) setDesktopMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMoreOpen(false); setCreateOpen(false); setDesktopMoreOpen(false); }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen, createOpen, desktopMoreOpen]);

  if (!session?.user) return null;

  const profileHref = profileData?.profile?.username
    ? `/profile/${profileData.profile.username}`
    : "/onboarding/username";
  const identity: NavigationItem[] = [
    { id: "profile", href: profileHref, label: "Profile", icon: User },
  ];

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-bg px-4 py-5 lg:flex">
        <Link href="/home" className="mb-7 flex items-center gap-2 px-2">
          <Image
            src="/logo_yoohoo.png"
            alt="Yoohoo"
            width={32}
            height={32}
            className="h-9 w-9 rounded-lg"
          />
        </Link>

        <nav
          className="flex min-h-0 flex-1 flex-col gap-1"
          aria-label="Main navigation"
        >
          {discovery.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
          {workspace.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
          <NotificationBell />
          {identity.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}

          <div ref={createRef} className="relative mt-4">
            <button type="button" onClick={() => setCreateOpen(value => !value)} aria-expanded={createOpen} aria-haspopup="menu" className="flex w-full items-center justify-center gap-2 rounded-xl bg-action-primary px-4 py-3 text-sm font-bold text-on-action-primary transition hover:bg-action-primary-hover">
              Create <ChevronDown className={`h-4 w-4 transition ${createOpen ? "rotate-180" : ""}`} />
            </button>
            {createOpen && <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-xl">
              <Link href="/desk" role="menuitem" onClick={() => setCreateOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-text hover:bg-surface-hover"><FilePlus2 className="h-5 w-5" />Create your deck</Link>
              <Link href="/home?compose=1" role="menuitem" onClick={() => { setCreateOpen(false); window.dispatchEvent(new Event("yoohoo:open-composer")); }} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-text hover:bg-surface-hover"><PenLine className="h-5 w-5" />Post</Link>
            </div>}
          </div>

          <div ref={desktopMoreRef} className="relative mt-auto">
            {desktopMoreOpen && <div role="menu" className="absolute bottom-14 left-0 w-full overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-xl">
              <Link href="/settings" role="menuitem" onClick={() => setDesktopMoreOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-surface-hover"><Settings className="h-4 w-4" />Settings</Link>
              <Link href="/trash" role="menuitem" onClick={() => setDesktopMoreOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-surface-hover"><Trash2 className="h-4 w-4" />Trash</Link>
              <div className="my-1 h-px bg-border" />
              <LanguageSwitcher mobile />
              <button type="button" role="menuitem" onClick={() => void handleLogout()} disabled={isLoggingOut} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-50"><LogOut className="h-4 w-4" />{isLoggingOut ? "Logging out..." : t("nav.logout")}</button>
            </div>}
            <button type="button" onClick={() => setDesktopMoreOpen(value => !value)} aria-expanded={desktopMoreOpen} aria-haspopup="menu" className={`flex w-full items-center gap-4 rounded-xl px-3 py-3 text-[15px] font-medium transition ${desktopMoreOpen ? "bg-surface-hover text-text" : "text-text-secondary hover:text-text"}`}><MoreHorizontal className="h-5 w-5" />More</button>
          </div>
        </nav>
      </aside>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-bg px-2 py-2 lg:hidden"
        aria-label="Mobile navigation"
      >
        {[...discovery, workspace[0], workspace[1], identity[0]].map((item) => (
          <NavItem key={item.href} item={item} compact />
        ))}
        <div ref={moreRef} className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={`nav-focus flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] transition ${moreOpen ? "bg-surface-hover text-text" : "text-text-muted hover:bg-surface-hover"}`}
          >
            {moreOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
            More
          </button>
          {moreOpen && (
            <div
              className="absolute bottom-14 right-0 w-56 rounded-2xl border border-border bg-surface p-2 shadow-xl"
              role="menu"
            >
              {moreItems.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  onClick={() => setMoreOpen(false)}
                />
              ))}
              <div className="my-2 h-px bg-border" />
              <LanguageSwitcher mobile />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  void handleLogout();
                }}
                disabled={isLoggingOut}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-text-secondary transition hover:bg-surface-hover hover:text-text disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {isLoggingOut ? "Logging out..." : t("nav.logout")}
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
