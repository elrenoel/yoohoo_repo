"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, CheckCircle2, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { normalizeUsername, RESERVED_USERNAMES, USERNAME_PATTERN } from "@/lib/profile-validation";

type InitialProfile = { username?: string; displayName: string; bio?: string; avatarUrl?: string | null };

export default function ProfileForm({ initial, mode, onSaved }: {
  initial: InitialProfile;
  mode: "create" | "edit";
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(initial.username ?? "");
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid">(mode === "edit" ? "available" : "idle");
  const [submitting, setSubmitting] = useState(false);
  const normalized = useMemo(() => normalizeUsername(username), [username]);

  useEffect(() => {
    if (mode === "edit" && normalized === initial.username) return;
    if (!USERNAME_PATTERN.test(normalized) || RESERVED_USERNAMES.has(normalized)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/profiles/check-username?u=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        const data = await response.json() as { available?: boolean };
        setAvailability(response.ok && data.available ? "available" : "taken");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setAvailability("idle");
      }
    }, 400);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [initial.username, mode, normalized, username]);

  function changeUsername(value: string) {
    const next = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const nextNormalized = normalizeUsername(next);
    setUsername(next);
    if (mode === "edit" && nextNormalized === initial.username) setAvailability("available");
    else if (!next) setAvailability("idle");
    else if (!USERNAME_PATTERN.test(nextNormalized) || RESERVED_USERNAMES.has(nextNormalized)) setAvailability("invalid");
    else setAvailability("checking");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (availability !== "available" || submitting) return;
    setSubmitting(true);
    const loadingId = toast.loading(t("profile.saving"));
    try {
      const response = await fetch("/api/profile", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized, displayName, bio, avatarUrl: avatarUrl || null }),
      });
      const data = await response.json() as { profile?: { username: string }; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || t("profile.saveFailed"));
      toast.success(t(mode === "create" ? "profile.created" : "profile.updated"), { id: loadingId });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      onSaved?.();
      router.push(`/profile/${data.profile.username}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("profile.saveFailed"), { id: loadingId });
    } finally { setSubmitting(false); }
  }

  const status = availability === "checking" ? <><LoaderCircle className="h-4 w-4 animate-spin" /> {t("profile.checking")}</>
    : availability === "available" ? <><CheckCircle2 className="h-4 w-4" /> {t("profile.available")}</>
    : availability === "taken" ? <><XCircle className="h-4 w-4" /> {t("profile.taken")}</>
    : availability === "invalid" ? <><XCircle className="h-4 w-4" /> {t("profile.invalidUsername")}</> : null;

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">{t("profile.username")}</span>
        <div className="flex rounded-lg border border-border bg-surface focus-within:border-accent">
          <span className="px-3 py-3 text-text-secondary">@</span>
          <input value={username} onChange={(event) => changeUsername(event.target.value)} maxLength={20} autoComplete="username" className="min-w-0 flex-1 bg-transparent py-3 pr-3 outline-none" required />
        </div>
        <span className={`mt-2 flex min-h-5 items-center gap-1.5 text-xs ${availability === "available" ? "text-success-text" : availability === "checking" || availability === "idle" ? "text-text-secondary" : "text-danger-text"}`}>{status}</span>
      </label>
      <label className="block">
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">{t("profile.displayName")}</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} required className="w-full rounded-lg border border-border bg-surface px-3 py-3 outline-none focus:border-accent" />
      </label>
      <label className="block">
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">{t("profile.bio")}</span>
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} rows={4} className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-3 outline-none focus:border-accent" />
        <span className="mt-1 block text-right font-mono text-[11px] text-text-secondary">{bio.length}/160</span>
      </label>
      {mode === "edit" && <label className="block">
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">{t("profile.avatarUrl")}</span>
        <input type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-3 outline-none focus:border-accent" placeholder="https://…" />
      </label>}
      <button type="submit" disabled={availability !== "available" || submitting || !displayName.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-action-primary px-4 py-3 font-semibold text-on-action-primary transition hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
        {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{t(mode === "create" ? "profile.create" : "profile.save")}
      </button>
    </form>
  );
}
