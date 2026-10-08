import type { QueryClient } from "@tanstack/react-query";
import type { OptimisticIntentResponse } from "@/hooks/use-optimistic-intent-mutation";

export type SocialAction = "like" | "bookmark" | "repost";
export type SocialTargetType = "post" | "public_deck";

const fields = {
  like: { active: "likedByMe", count: "likeCount" },
  bookmark: { active: "bookmarkedByMe", count: null },
  repost: { active: "repostedByMe", count: "repostCount" },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesTarget(value: Record<string, unknown>, targetType: SocialTargetType, targetId: string) {
  if (String(value.id ?? "") !== targetId) return false;
  const cachedType = value.type;
  if (cachedType === undefined) return "likedByMe" in value || "bookmarkedByMe" in value || "repostedByMe" in value;
  return cachedType === targetType || (targetType === "public_deck" && cachedType === "deck");
}

function patchValue(
  value: unknown,
  targetType: SocialTargetType,
  targetId: string,
  action: SocialAction,
  state: OptimisticIntentResponse,
): unknown {
  if (Array.isArray(value)) return value.map((item) => patchValue(item, targetType, targetId, action, state));
  if (!isRecord(value)) return value;

  let changed = false;
  const next: Record<string, unknown> = { ...value };
  if (matchesTarget(value, targetType, targetId)) {
    const field = fields[action];
    next[field.active] = state.active;
    if (field.count && state.count !== undefined) next[field.count] = state.count;
    changed = true;
  }

  for (const [key, child] of Object.entries(next)) {
    const patched = patchValue(child, targetType, targetId, action, state);
    if (patched !== child) {
      next[key] = patched;
      changed = true;
    }
  }
  return changed ? next : value;
}

export function updateSocialCaches(
  queryClient: QueryClient,
  targetType: SocialTargetType,
  targetId: string,
  action: SocialAction,
  state: OptimisticIntentResponse,
) {
  queryClient.setQueriesData(
    { predicate: (query) => query.state.data !== undefined },
    (cached) => patchValue(cached, targetType, targetId, action, state),
  );

  if (action === "bookmark" && !state.active) {
    queryClient.setQueriesData(
      { queryKey: ["saved", targetType] },
      (cached) => {
        if (!isRecord(cached) || !Array.isArray(cached.items)) return cached;
        return { ...cached, items: cached.items.filter((item) => !isRecord(item) || String(item.id) !== targetId) };
      },
    );
  }
}
