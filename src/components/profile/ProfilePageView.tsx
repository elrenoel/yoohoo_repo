"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  PenLine,
  Repeat2,
  X,
} from "lucide-react";
import type { PublicProfile } from "@/lib/profile-server";
import ProfileForm from "@/components/profile/ProfileForm";
import FollowControls from "@/components/profile/FollowControls";
import PostCard, { DeckFolderCard } from "@/components/posts/PostCard";
import UserAvatar from "@/components/profile/UserAvatar";

type Tab = "activity" | "posts" | "decks";

export default function ProfilePageView({
  profile,
  isOwner,
  initialFollowing = false,
}: {
  profile: PublicProfile;
  isOwner: boolean;
  initialFollowing?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("activity"),
    [editing, setEditing] = useState(false),
    [createOpen, setCreateOpen] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false),
    [cropping, setCropping] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  function closeEditor() {
    if (profileDirty && !window.confirm("Discard unsaved profile changes?"))
      return;
    setEditing(false);
    setProfileDirty(false);
    setCropping(false);
  }

  useEffect(() => {
    if (!createOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        createRef.current &&
        !createRef.current.contains(event.target as Node)
      )
        setCreateOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreateOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [createOpen]);
  const empty =
    (tab === "posts" && !profile.posts.length) ||
    (tab === "decks" && !profile.publicDecks.length) ||
    (tab === "activity" && !profile.activity.length);
  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="border-b border-border px-5 py-4 text-center">
        <h1 className="text-lg font-bold">{profile.displayName}</h1>
      </header>
      <div className="mx-auto w-full max-w-[720px] px-5 pb-24 sm:px-0">
        <section className="px-0 pb-2 pt-5 sm:pt-7">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="min-w-0 pt-3 sm:order-1">
              <h2 className="text-2xl font-bold">{profile.displayName}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                @{profile.username}
              </p>
              {profile.bio && (
                <p className="mt-5 max-w-lg whitespace-pre-wrap text-[15px] leading-6 text-text-secondary">
                  {profile.bio}
                </p>
              )}
              <FollowControls
                targetUserId={profile.userId}
                username={profile.username}
                isOwner={isOwner}
                initialFollowing={initialFollowing}
                initialFollowers={profile.counts.followers}
                initialFollowingCount={profile.counts.following}
              />
            </div>
            <div className="sm:order-2">
              <UserAvatar
                src={profile.avatarUrl}
                name={profile.displayName}
                size={96}
                textClassName="text-xl"
              />
            </div>
          </div>
          {isOwner && (
            <div className="mt-6 grid grid-cols-[1fr_1fr_auto] items-start gap-2">
              <div ref={createRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCreateOpen((value) => !value)}
                  aria-expanded={createOpen}
                  aria-haspopup="menu"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-action-primary text-sm font-bold text-on-action-primary transition hover:bg-action-primary-hover"
                >
                  Create
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${createOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {createOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-50 mt-2 w-full min-w-[208px] overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-[0_14px_34px_rgba(22,36,29,.16)]"
                  >
                    <Link
                      href="/desk"
                      role="menuitem"
                      onClick={() => setCreateOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-text transition hover:bg-surface-hover"
                    >
                      <FilePlus2 className="h-5 w-5 shrink-0" />
                      Create your deck
                    </Link>
                    <Link
                      href="/home?compose=1"
                      role="menuitem"
                      onClick={() => setCreateOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-text transition hover:bg-surface-hover"
                    >
                      <PenLine className="h-5 w-5 shrink-0" />
                      Post
                    </Link>
                  </div>
                )}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-bold"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </button>
              <button
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface"
                aria-label="More profile options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          )}
        </section>

        <nav className="mt-3 flex border-b border-border">
          {(
            [
              ["activity", "Activity"],
              ["posts", "Posts"],
              ["decks", "Decks"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex-1 border-b-2 px-3 py-4 text-sm font-semibold ${tab === value ? "border-accent text-text" : "border-transparent text-text-muted"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="mt-5 divide-y divide-border border-t border-border">
          {tab === "activity" &&
            profile.activity.map((item) =>
              item.action === "published_deck" ? (
                <div key={item.key} className="pb-6">
                  <DeckFolderCard
                    deck={{
                      slug: item.deck.slug,
                      sourceDeckId: item.deck.sourceDeckId,
                      title: item.deck.title,
                      description: `${item.deck.cardCount} cards · ${item.deck.completions} completions${item.deck.averageScore !== null ? ` · ${item.deck.averageScore}% average` : ""}`,
                      tags: item.deck.tags,
                    }}
                  />
                </div>
              ) : (
                <div key={item.key}>
                  {item.action === "reposted_post" && (
                    <div className="flex items-center gap-2 pt-5 text-xs font-semibold text-text-muted">
                      <Repeat2 className="h-4 w-4" />
                      <span>{profile.displayName} reposted</span>
                    </div>
                  )}
                  <PostCard item={item.post} />
                </div>
              ),
            )}
          {tab === "posts" &&
            profile.posts.map((post) => <PostCard key={post.id} item={post} />)}
          {tab === "decks" &&
            profile.publicDecks.map((deck) => (
              <div key={deck.slug} className="pb-6">
                <DeckFolderCard
                  deck={{
                    slug: deck.slug,
                    sourceDeckId: deck.sourceDeckId,
                    title: deck.title,
                    description: `${deck.cardCount} cards · ${deck.completions} completions${deck.averageScore !== null ? ` · ${deck.averageScore}% average` : ""}`,
                    tags: deck.tags,
                  }}
                />
              </div>
            ))}
        </section>
        {empty && (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <PenLine className="h-6 w-6 text-text-muted" />
            <h3 className="mt-4 text-sm font-bold">
              {isOwner
                ? "You haven’t published anything yet."
                : "Nothing published yet."}
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              {isOwner
                ? "Share a learning note or publish a deck to get started."
                : "Published posts and decks will appear here."}
            </p>
            {isOwner && (
              <Link
                href="/home?compose=1"
                className="mt-4 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold"
              >
                Create a post
              </Link>
            )}
          </div>
        )}
      </div>
      {editing && (
        <div
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-overlay sm:items-center sm:p-5"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface-raised p-6 sm:p-8"
          >
            {!cropping && (
              <header className="mb-6 flex items-center justify-between">
                <h2 id="edit-profile-title" className="text-xl font-bold">
                  Edit profile
                </h2>
                <button
                  type="button"
                  aria-label="Close edit profile"
                  onClick={closeEditor}
                  className="rounded-full p-2 hover:bg-surface-hover"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>
            )}
            <ProfileForm
              mode="edit"
              initial={profile}
              onDirtyChange={setProfileDirty}
              onCroppingChange={setCropping}
              onSaved={() => {
                setProfileDirty(false);
                setEditing(false);
              }}
            />
          </section>
        </div>
      )}
    </main>
  );
}
