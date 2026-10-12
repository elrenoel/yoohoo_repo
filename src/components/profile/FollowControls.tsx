"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { useOptimisticIntentMutation } from "@/hooks/use-optimistic-intent-mutation";
import { useSession } from "@/lib/session-provider";
type Person = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};
export default function FollowControls({
  targetUserId,
  username,
  isOwner,
  initialFollowing,
  initialFollowers,
  initialFollowingCount,
}: {
  targetUserId: string;
  username: string;
  isOwner: boolean;
  initialFollowing: boolean;
  initialFollowers: number;
  initialFollowingCount: number;
}) {
  const toast = useToast(),
    [list, setList] = useState<"followers" | "following" | null>(null),
    [people, setPeople] = useState<Person[]>([]),
    [listLoading, setListLoading] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const follow = useOptimisticIntentMutation({
    entityKey: `follow:user:${targetUserId}`,
    initialState: { active: initialFollowing, count: initialFollowers },
    request: async (desired) => {
      const response = await fetch(`/api/follows/${targetUserId}`, {
          method: desired ? "PUT" : "DELETE",
        }),
        data = (await response.json()) as Record<string, unknown>;
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not update follow status.",
        );
      return {
        active: typeof data.following === "boolean" ? data.following : desired,
        count:
          typeof data.followerCount === "number"
            ? data.followerCount
            : undefined,
      };
    },
    updateCache: () => {},
    onError: () => toast.error("Something went wrong. Try again."),
  });
  function toggle() {
    if (!session?.user) {
      toast.info("Log in to continue.", { action: { label: "Log in", onClick: () => router.push(`/login?next=${encodeURIComponent(pathname)}`) } });
      return;
    }
    if (!isOwner) follow.setDesiredState(!follow.active);
  }
  function openList(next: "followers" | "following") {
    setPeople([]);
    setListLoading(true);
    setList(next);
  }
  useEffect(() => {
    if (!list) return;
    let active = true;
    void fetch(`/api/users/${encodeURIComponent(username)}/${list}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (active) setPeople(data.items || []);
      })
      .catch(() => {
        if (active) toast.error("Could not load this user list.");
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => {
      active = false;
    };
  }, [list, toast, username]);
  return (
    <>
      <div className="mt-5 flex flex-col items-stretch gap-4">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => openList("followers")}
            className="text-center flex flex-col"
          >
            <strong aria-live="polite" className="font-serif text-l">
              {follow.count ?? initialFollowers}
            </strong>
            <span className="ml-2 text-xs text-text-secondary">Followers</span>
          </button>
          <button
            onClick={() => openList("following")}
            className="text-center flex flex-col"
          >
            <strong className="font-serif text-l">
              {initialFollowingCount}
            </strong>
            <span className="ml-2 text-xs text-text-secondary">Following</span>
          </button>
        </div>
        {!isOwner && (
          <button
            onClick={toggle}
            aria-pressed={follow.active}
            className={`w-full px-4 py-2 text-l font-semibold rounded-xl transition-transform duration-150 motion-reduce:transition-none ${follow.active ? "border border-accent bg-accent-subtle text-accent" : "bg-action-primary text-on-action-primary"}`}
          >
            {follow.active ? "Following" : "Follow"}
          </button>
        )}
      </div>
      {list && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center sm:p-5">
          <div className="max-h-[75vh] w-full max-w-md overflow-y-auto border border-border bg-bg p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold">
                {list === "followers" ? "Followers" : "Following"}
              </h2>
              <button onClick={() => setList(null)}>
                <X />
              </button>
            </div>
            <div className="mt-5 divide-y divide-border">
              {listLoading ? (
                <LoaderCircle className="mx-auto animate-spin" />
              ) : people.length ? (
                people.map((person) => (
                  <Link
                    key={person.userId}
                    href={`/u/${person.username}`}
                    onClick={() => setList(null)}
                    className="block py-4"
                  >
                    <p className="font-semibold">{person.displayName}</p>
                    <p className="font-mono text-xs text-text-secondary">
                      @{person.username}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-text-secondary">
                  No users here yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
