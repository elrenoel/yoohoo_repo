"use client";

import Image from "next/image";
import { useState } from "react";
import { BookOpen, FileText, Pencil, PenLine, X } from "lucide-react";
import Link from "next/link";
import type { PublicProfile } from "@/lib/profile-server";
import ProfileForm from "@/components/profile/ProfileForm";
import { useI18n } from "@/lib/i18n";
import FollowControls from "@/components/profile/FollowControls";

export default function PublicProfileView({ profile, isOwner, ownerDrafts=[], initialFollowing=false }: { profile: PublicProfile; isOwner: boolean; ownerDrafts?:Array<{id:string;title:string;status:"draft";updatedAt:string}>;initialFollowing?:boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"posts" | "decks">("posts");
  const [editing, setEditing] = useState(false);
  const initials = profile.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <main className="min-h-screen bg-[#F5F6F3] px-4 py-8 text-[#16241D] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <section className="relative border border-[#D8DCD3] bg-[#FAFBF8] p-6 sm:p-10">
          <div className="absolute bottom-0 left-7 top-0 w-px bg-[#C24A3D]/55" aria-hidden="true" />
          <div className="relative pl-7 sm:flex sm:items-start sm:justify-between sm:gap-8">
            <div className="flex min-w-0 items-start gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D8DCD3] bg-[#E7EFE9] font-serif text-2xl font-semibold text-[#164C3D]">
                {profile.avatarUrl ? <Image src={profile.avatarUrl} alt="" width={80} height={80} unoptimized className="h-full w-full object-cover" /> : initials}
              </div>
              <div className="min-w-0">
                <h1 className="break-words font-serif text-3xl font-semibold sm:text-4xl">{profile.displayName}</h1>
                <p className="mt-1 font-mono text-sm text-[#5B6B62]">@{profile.username}</p>
                {profile.bio && <p className="mt-4 max-w-2xl whitespace-pre-wrap leading-7 text-[#38483F]">{profile.bio}</p>}
              </div>
            </div>
            {isOwner && <div className="mt-5 flex gap-2 sm:mt-0"><Link href="/tulis" className="inline-flex items-center gap-2 rounded-lg bg-[#164C3D] px-4 py-2 text-sm font-semibold text-white"><PenLine className="h-4 w-4"/>Tulis</Link><button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg border border-[#164C3D] px-4 py-2 text-sm font-semibold text-[#164C3D] hover:bg-[#E7EFE9]"><Pencil className="h-4 w-4" />{t("profile.edit")}</button></div>}
          </div>
          <FollowControls targetUserId={profile.userId} username={profile.username} isOwner={isOwner} initialFollowing={initialFollowing} initialFollowers={profile.counts.followers} initialFollowingCount={profile.counts.following}/>
          <div className="relative mt-4 grid grid-cols-2 gap-px border border-[#D8DCD3] bg-[#D8DCD3] pl-7">
            {([[t("profile.posts"), profile.counts.posts], [t("profile.decks"), profile.counts.decks]] as const).map(([label, count]) => <div key={label} className="bg-[#FAFBF8] p-4"><div className="font-serif text-2xl font-semibold">{count}</div><div className="font-mono text-[11px] uppercase tracking-wider text-[#5B6B62]">{label}</div></div>)}
          </div>
        </section>

        <section className="mt-8 border border-[#D8DCD3] bg-[#FAFBF8]">
          <div className="flex border-b border-[#D8DCD3]">
            <button onClick={() => setTab("posts")} className={`flex-1 px-5 py-4 text-sm font-semibold ${tab === "posts" ? "border-b-2 border-[#164C3D] text-[#164C3D]" : "text-[#5B6B62]"}`}>{t("profile.posts")}</button>
            <button onClick={() => setTab("decks")} className={`flex-1 px-5 py-4 text-sm font-semibold ${tab === "decks" ? "border-b-2 border-[#164C3D] text-[#164C3D]" : "text-[#5B6B62]"}`}>{t("profile.decks")}</button>
          </div>
          {tab === "posts" && (profile.posts.length>0||ownerDrafts.length>0) ? <div className="divide-y divide-[#D8DCD3]">{profile.posts.map(post=><Link key={post.id} href={`/p/${post.slug}`} className="block p-6 hover:bg-[#F0F4EF]"><p className="font-mono text-[10px] uppercase text-emerald-700">Terbit</p><h2 className="mt-2 font-serif text-2xl font-semibold">{post.title}</h2><p className="mt-2 text-sm text-[#5B6B62]">{post.excerpt}</p></Link>)}{ownerDrafts.map(post=><Link key={post.id} href={`/tulis/${post.id}`} className="block border-l-2 border-[#C24A3D] p-6 hover:bg-[#F0F4EF]"><p className="font-mono text-[10px] uppercase text-[#C24A3D]">Draft · hanya kamu</p><h2 className="mt-2 font-serif text-2xl font-semibold">{post.title||"Tanpa judul"}</h2></Link>)}</div> : tab === "decks" && profile.publicDecks.length > 0 ? <div className="grid gap-px bg-[#D8DCD3] sm:grid-cols-2">{profile.publicDecks.map(deck=><a key={deck.slug} href={`/d/${deck.slug}`} className="bg-[#FAFBF8] p-5 hover:bg-[#F0F4EF]"><div className="font-mono text-[10px] uppercase text-[#5B6B62]">V{deck.version} · {deck.cardCount} kartu</div><h2 className="mt-2 font-serif text-xl font-semibold">{deck.title}</h2><div className="mt-3 flex flex-wrap gap-1">{deck.tags.map(tag=><span key={tag} className="border border-[#D8DCD3] px-2 py-1 font-mono text-[10px]">#{tag}</span>)}</div><p className="mt-4 text-xs text-[#5B6B62]">{deck.completions} penyelesai · {deck.averageScore===null?"Rata-rata belum tersedia":`${deck.averageScore}% rata-rata`}</p></a>)}</div> : <div className="flex min-h-64 flex-col items-center justify-center px-6 py-14 text-center">
            {tab === "posts" ? <FileText className="h-8 w-8 text-[#5B6B62]" /> : <BookOpen className="h-8 w-8 text-[#5B6B62]" />}
            <h2 className="mt-4 font-serif text-xl font-semibold">{t(tab === "posts" ? "profile.noPosts" : "profile.noDecks")}</h2>
            <p className="mt-2 max-w-sm text-sm text-[#5B6B62]">{t(tab === "posts" ? "profile.noPostsDescription" : "profile.noDecksDescription")}</p>
          </div>}
        </section>
      </div>
      {editing && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
        <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto border border-[#D8DCD3] bg-[#F5F6F3] p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between"><h2 id="edit-profile-title" className="font-serif text-2xl font-semibold">{t("profile.edit")}</h2><button onClick={() => setEditing(false)} aria-label={t("common.close")} className="rounded-lg p-2 hover:bg-[#E4E7E1]"><X className="h-5 w-5" /></button></div>
          <ProfileForm mode="edit" initial={profile} onSaved={() => setEditing(false)} />
        </div>
      </div>}
    </main>
  );
}
