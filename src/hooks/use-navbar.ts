"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/hooks/use-language";
import { useAccountActions } from "@/hooks/use-account-actions";

export interface NavbarNavLink {
  href: string;
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
}

export interface UseNavbarReturn {
  session: ReturnType<typeof useAccountActions>["session"];
  isSessionPending: boolean;
  navLinks: NavbarNavLink[];
  lang: "id" | "en";
  t: ReturnType<typeof useLanguage>["t"];
  handleLogout: () => Promise<void>;
  isLoggingOut: boolean;
  pathname: string;
}

/** Compatibility hook for the public/document header. App navigation uses AppShell. */
export function useNavbar(): UseNavbarReturn {
  const pathname = usePathname();
  const { session, isSessionPending, handleLogout, isLoggingOut } = useAccountActions();
  const { t, lang } = useLanguage();

  const navLinks: NavbarNavLink[] = [
    { href: "/desk", label: "Your Desk", isActive: pathname === "/desk" },
    { href: "/history", label: t("nav.history"), isActive: pathname === "/history" },
  ];

  return {
    session,
    isSessionPending,
    navLinks,
    lang,
    t,
    handleLogout,
    isLoggingOut,
    pathname,
  };
}
