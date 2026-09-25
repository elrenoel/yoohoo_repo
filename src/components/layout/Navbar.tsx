"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ChevronLeft,
  Languages,
  User as UserIcon,
  LogOut,
  EllipsisVertical,
  Trash2,
  Clock,
  Menu,
  X,
} from "lucide-react";
import { useNavbar } from "@/hooks/use-navbar";
import { useLanguage } from "@/hooks/use-language";
import type { Lang } from "@/lib/i18n";

interface NavbarProps {
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  backHref?: string;
  title?: string;
  subtitle?: React.ReactNode;
  bottomBar?: React.ReactNode;
}

export default function Navbar({
  centerContent,
  rightContent,
  backHref,
  title,
  subtitle,
  bottomBar,
}: NavbarProps) {
  const {
    session,
    isSessionPending,
    t,
    handleLogout,
    isLoggingOut,
    navLinks,
  } = useNavbar();
  const { lang, setLang } = useLanguage();

  const isLoggedIn = !isSessionPending && !!session?.user;

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  // ── Close user dropdown on outside click ─────────────────────────────
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // ── Close user dropdown on Escape ────────────────────────────────────
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  // ── Close mobile menu on outside click ───────────────────────────────
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node) &&
        mobileMenuButtonRef.current &&
        !mobileMenuButtonRef.current.contains(e.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileMenuOpen]);

  // ── Close mobile menu on Escape ──────────────────────────────────────
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileMenuOpen]);

  // ── Lock body scroll when mobile menu is open ────────────────────────
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
    setMenuOpen(false);
  }, []);

  // ── Language toggle (desktop) ──────────────────────────────────────────
  const languageToggle = (
    <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FDF7EB] text-xs font-medium transition"
      title="Bahasa / Language"
      style={{ color: '#041914' }}
    >
      <Languages className="w-3.5 h-3.5 shrink-0" style={{ color: '#041914' }} />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Bahasa / Language"
        className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
        style={{ color: '#041914' }}
      >
        <option value="id" className="bg-[#FDF7EB]" style={{ color: '#041914' }}>ID</option>
        <option value="en" className="bg-[#FDF7EB]" style={{ color: '#041914' }}>EN</option>
      </select>
    </div>
  );

  // ── Language toggle (mobile — full width) ──────────────────────────────
  const languageToggleMobile = (
    <div className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#FDF7EB] text-xs font-medium transition w-full"
      title="Bahasa / Language"
      style={{ color: '#041914' }}
    >
      <Languages className="w-4 h-4 shrink-0" style={{ color: '#041914' }} />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Bahasa / Language"
        className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer flex-1"
        style={{ color: '#041914' }}
      >
        <option value="id" className="bg-[#FDF7EB]" style={{ color: '#041914' }}>Bahasa Indonesia</option>
        <option value="en" className="bg-[#FDF7EB]" style={{ color: '#041914' }}>English</option>
      </select>
    </div>
  );

  // ── User menu dropdown (desktop) ───────────────────────────────────────
  const userMenu = !isSessionPending && session?.user && (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#FDF7EB] border border-[#FDF7EB]/30 text-xs font-medium transition cursor-pointer"
        style={{ color: '#041914' }}
      >
        <UserIcon className="w-3.5 h-3.5" style={{ color: '#041914' }} />
        <span className="hidden sm:inline truncate max-w-[100px]">
          {session.user.name || session.user.email}
        </span>
        <EllipsisVertical className="w-3.5 h-3.5" style={{ color: '#041914' }} />
      </button>

      {/* Dropdown overlay + panel */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMenuOpen(false)}
      />
      <div
        className={`absolute right-0 mt-2 w-56 rounded-xl shadow-lg z-50 overflow-hidden transition-all duration-200 ease-out origin-top-right ${menuOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"}`}
        style={{ backgroundColor: '#FDF7EB' }}
      >
        {/* User info header */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #ccc' }}>
          <p className="text-sm font-medium truncate" style={{ color: '#041914' }}>
            {session.user.name}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: '#041914', opacity: 0.7 }}>
            {session.user.email}
          </p>
        </div>

        {/* Menu items */}
        <div className="py-1.5">
          <Link
            href="/history"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#EDEABF] transition-colors"
            style={{ color: '#041914' }}
          >
            <Clock className="w-4 h-4" style={{ color: '#041914' }} />
            {t("nav.history")}
          </Link>
          <Link
            href="/trash"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#EDEABF] transition-colors"
            style={{ color: '#041914' }}
          >
            <Trash2 className="w-4 h-4" style={{ color: '#041914' }} />
            {t("nav.trash")}
          </Link>
        </div>

        {/* Logout */}
        <div className="py-1.5" style={{ borderTop: '1px solid #ccc' }}>
          <button
            onClick={() => { setMenuOpen(false); handleLogout(); }}
            disabled={isLoggingOut}
            title={t("nav.logoutTitle")}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors disabled:opacity-50 cursor-pointer"
            style={{ color: '#041914' }}
          >
            <LogOut className="w-4 h-4" />
            {t("nav.logout")}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Auth section (login/register for guests) ──────────────────────────
  const authSection = !isSessionPending && (
    <>
      {session?.user ? (
        userMenu
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-3 py-1.5 text-xs font-medium transition"
            style={{ color: '#FDF7EB' }}
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/register"
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg transition shadow-2xs"
            style={{ backgroundColor: '#FDF7EB', color: '#013528' }}
          >
            {t("nav.register")}
          </Link>
        </div>
      )}
    </>
  );

  // ── Left section: Logo or Back button ─────────────────────────────────
  const leftSection = backHref ? (
    <div className="flex items-center gap-3 min-w-0">
      <Link
        href={backHref}
        className="w-8 h-8 rounded-lg bg-[#FDF7EB] hover:bg-[#FDF7EB]/50 flex items-center justify-center text-neutral-900 transition shrink-0"
        title={t("error.backToHome")}
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>
      {title && (
        <div className="min-w-0">
          <h1 className="font-semibold text-[#FDF7EB] text-sm sm:text-base tracking-tight truncate max-w-[160px] sm:max-w-md">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-[#FDF7EB] font-mono">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  ) : (
    <Link href={isLoggedIn ? "/app" : "/"} className="flex items-center gap-2.5 group shrink-0">
      <img
        src="/logo_yoohoo.png"
        alt="Yoohoo logo"
        className="w-8 h-8 rounded-lg object-contain"
      />
      <span className="font-semibold tracking-tight text-lg" style={{ color: '#FDF7EB' }}>
        Yoohoo
      </span>
    </Link>
  );

  // ── Hamburger button (mobile only) ────────────────────────────────────
  const hamburgerButton = (
    <button
      ref={mobileMenuButtonRef}
      onClick={toggleMobileMenu}
      className="sm:hidden w-9 h-9 rounded-lg flex items-center justify-center transition cursor-pointer"
      style={{ color: '#FDF7EB' }}
      aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
      aria-expanded={mobileMenuOpen}
    >
      <div className="relative w-5 h-5">
        <Menu
          className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${mobileMenuOpen ? "rotate-90 opacity-0 scale-75" : "rotate-0 opacity-100 scale-100"}`}
        />
        <X
          className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${mobileMenuOpen ? "rotate-0 opacity-100 scale-100" : "-rotate-90 opacity-0 scale-75"}`}
        />
      </div>
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <header className="bg-[#013528] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            {leftSection}

          {/* Default nav links (logged-in users, non-document layout) — desktop only */}
          {session?.user && !backHref && (
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={link.isActive ? "px-3 py-1.5 text-xs font-semibold rounded-lg transition" : "px-3 py-1.5 text-xs font-medium rounded-lg transition"}
                  style={{ color: '#FDF7EB' }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {centerContent && (
            <div className="hidden sm:flex items-center gap-3">{centerContent}</div>
          )}

          {/* Desktop right section */}
          <div className="hidden sm:flex items-center gap-3">
            {rightContent}
            {languageToggle}
            {authSection}
          </div>

          {/* Mobile: hamburger button */}
          <div className="flex sm:hidden items-center gap-2">
            {hamburgerButton}
          </div>
        </div>
      </header>

      {/* ── Mobile menu overlay ────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 sm:hidden ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile menu panel ──────────────────────────────────────────── */}
      <div
        ref={mobileMenuRef}
        className={`fixed top-[56px] left-0 right-0 z-50 sm:hidden transition-all duration-300 ease-out ${mobileMenuOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-3 pointer-events-none"}`}
      >
        <div className="bg-[#013528] border-b border-neutral-700 shadow-xl max-h-[calc(100vh-56px)] overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-1">
            {/* Nav links for logged-in users */}
            {session?.user && !backHref && (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${link.isActive ? "bg-white/10" : "hover:bg-white/5"}`}
                    style={{ color: '#FDF7EB' }}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="h-px bg-white/10 my-2" />
              </>
            )}

            {/* Center content (demo button etc) for guests */}
            {!session?.user && centerContent && (
              <>
                <div className="px-4 py-2">{centerContent}</div>
                <div className="h-px bg-white/10 my-2" />
              </>
            )}

            {/* Language toggle */}
            <div className="px-4 py-1">{languageToggleMobile}</div>

            {/* Auth section for logged-in users */}
            {session?.user ? (
              <>
                <div className="h-px bg-white/10 my-2" />
                <div className="px-4 py-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <UserIcon className="w-4 h-4" style={{ color: '#FDF7EB' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: '#FDF7EB' }}>
                        {session.user.name || session.user.email}
                      </p>
                      {session.user.name && session.user.email && (
                        <p className="text-xs truncate" style={{ color: '#FDF7EB', opacity: 0.6 }}>
                          {session.user.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Link
                      href="/history"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition"
                      style={{ color: '#FDF7EB' }}
                    >
                      <Clock className="w-4 h-4" />
                      {t("nav.history")}
                    </Link>
                    <Link
                      href="/trash"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition"
                      style={{ color: '#FDF7EB' }}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("nav.trash")}
                    </Link>
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                      disabled={isLoggingOut}
                      title={t("nav.logoutTitle")}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition disabled:opacity-50 cursor-pointer text-left w-full"
                      style={{ color: '#FDF7EB' }}
                    >
                      <LogOut className="w-4 h-4" />
                      {t("nav.logout")}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Auth buttons for guests */}
                <div className="h-px bg-white/10 my-2" />
                <div className="px-4 py-2 flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg text-center transition border"
                    style={{ color: '#FDF7EB', borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    {t("nav.login")}
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg text-center transition"
                    style={{ backgroundColor: '#FDF7EB', color: '#013528' }}
                  >
                    {t("nav.register")}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {bottomBar}
    </>
  );
}
