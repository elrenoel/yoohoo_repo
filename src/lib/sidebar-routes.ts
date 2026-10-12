export type SidebarItemId =
  | "home"
  | "explore"
  | "desk"
  | "saved"
  | "notifications"
  | "profile"
  | "settings"
  | "trash";

const sidebarRoutes: ReadonlyArray<{
  id: SidebarItemId;
  roots: readonly string[];
}> = [
  { id: "home", roots: ["/home", "/p"] },
  { id: "explore", roots: ["/explore", "/d"] },
  { id: "desk", roots: ["/desk", "/decks"] },
  { id: "saved", roots: ["/saved"] },
  { id: "notifications", roots: ["/notifications"] },
  { id: "profile", roots: ["/profile", "/u"] },
  { id: "settings", roots: ["/settings"] },
  { id: "trash", roots: ["/trash"] },
];

/** Match a complete path segment, never a partial prefix such as /saved-copy. */
export function matchesRouteRoot(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

/** A pathname resolves to at most one sidebar item. */
export function getActiveSidebarItem(pathname: string): SidebarItemId | null {
  return sidebarRoutes.find(({ roots }) =>
    roots.some((root) => matchesRouteRoot(pathname, root)),
  )?.id ?? null;
}

export function isSidebarItemActive(item: SidebarItemId, pathname: string) {
  return getActiveSidebarItem(pathname) === item;
}
