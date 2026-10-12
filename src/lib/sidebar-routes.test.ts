import assert from "node:assert/strict";
import test from "node:test";

import {
  getActiveSidebarItem,
  isSidebarItemActive,
  matchesRouteRoot,
} from "./sidebar-routes";

test("matches only exact paths and complete child segments", () => {
  assert.equal(matchesRouteRoot("/saved", "/saved"), true);
  assert.equal(matchesRouteRoot("/saved/folders", "/saved"), true);
  assert.equal(matchesRouteRoot("/saved-copy", "/saved"), false);
});

test("maps main routes and their child routes to exactly one item", () => {
  const cases = [
    ["/home", "home"],
    ["/p/post-id", "home"],
    ["/explore", "explore"],
    ["/d/public-deck", "explore"],
    ["/desk/deck-id", "desk"],
    ["/decks/deck-id", "desk"],
    ["/saved", "saved"],
    ["/notifications/item-id", "notifications"],
    ["/profile/elrenoel", "profile"],
    ["/u/elrenoel", "profile"],
  ] as const;

  for (const [pathname, expected] of cases) {
    assert.equal(getActiveSidebarItem(pathname), expected);
  }
});

test("never marks two items active and ignores overlapping-looking paths", () => {
  const items = [
    "home",
    "explore",
    "desk",
    "saved",
    "notifications",
    "profile",
    "settings",
    "trash",
  ] as const;

  for (const pathname of ["/notifications", "/profile/me", "/saved-copy", "/"] ) {
    assert.ok(items.filter((item) => isSidebarItemActive(item, pathname)).length <= 1);
  }
});
