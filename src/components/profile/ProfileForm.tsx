"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, LoaderCircle, Trash2, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/profile/UserAvatar";
import AvatarCropModal from "@/components/profile/AvatarCropModal";
import { useI18n } from "@/lib/i18n";
import { normalizeUsername, RESERVED_USERNAMES, USERNAME_PATTERN } from "@/lib/profile-validation";
import { useSession } from "@/lib/session-provider";
import { useToast } from "@/lib/toast";

type InitialProfile = { username?: string; displayName: string; bio?: string; avatarUrl?: string | null };

export default function ProfileForm({ initial, mode, onSaved, onDirtyChange, onCroppingChange }: {
  initial: InitialProfile;
  mode: "create" | "edit";
  onSaved?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onCroppingChange?: (cropping: boolean) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(initial.username ?? "");
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl ?? null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<{ url: string; isGif: boolean } | null>(null);
  const [avatarReset, setAvatarReset] = useState(false);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid">(mode === "edit" ? "available" : "idle");
  const [submitting, setSubmitting] = useState(false);
  const normalized = useMemo(() => normalizeUsername(username), [username]);

  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); };
  }, [avatarPreview]);

  useEffect(() => {
    return () => { if (cropSource) URL.revokeObjectURL(cropSource.url); };
  }, [cropSource]);

  useEffect(() => {
    onCroppingChange?.(Boolean(cropSource));
    return () => onCroppingChange?.(false);
  }, [cropSource, onCroppingChange]);

  const dirty = username !== (initial.username ?? "") || displayName !== initial.displayName || bio !== (initial.bio ?? "") || Boolean(avatarBlob) || Boolean(cropSource) || avatarReset;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

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
  }, [initial.username, mode, normalized]);

  function changeUsername(value: string) {
    const next = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const nextNormalized = normalizeUsername(next);
    setUsername(next);
    if (mode === "edit" && nextNormalized === initial.username) setAvailability("available");
    else if (!next) setAvailability("idle");
    else if (!USERNAME_PATTERN.test(nextNormalized) || RESERVED_USERNAMES.has(nextNormalized)) setAvailability("invalid");
    else setAvailability("checking");
  }

  function chooseAvatar(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error(t("profile.photoTypeInvalid"));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error(t("profile.photoTooLarge"));
      return;
    }
    setCropSource({ url: URL.createObjectURL(file), isGif: file.type === "image/gif" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function cancelCrop() {
    setCropSource(null);
  }

  function applyCrop(blob: Blob) {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarBlob(blob);
    setAvatarPreview(URL.createObjectURL(blob));
    setAvatarReset(false);
    cancelCrop();
  }

  function resetAvatar() {
    setAvatarBlob(null);
    setAvatarPreview(null);
    setAvatarUrl(null);
    setAvatarReset(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (availability !== "available" || submitting) return;
    setSubmitting(true);
    const loadingId = toast.loading(t("profile.saving"));
    try {
      let nextAvatarUrl = avatarUrl;
      if (avatarBlob) {
        const form = new FormData();
        form.set("avatar", avatarBlob, avatarBlob.type === "image/jpeg" ? "avatar.jpg" : "avatar.webp");
        const uploadResponse = await fetch("/api/profile/avatar", { method: "POST", body: form });
        const uploadData = await uploadResponse.json() as { avatarUrl?: string; error?: string };
        if (!uploadResponse.ok || !uploadData.avatarUrl) throw new Error(uploadData.error || t("profile.photoUploadFailed"));
        nextAvatarUrl = uploadData.avatarUrl;
      }

      const response = await fetch("/api/profile", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized, displayName, bio, avatarUrl: nextAvatarUrl }),
      });
      const data = await response.json() as { profile?: { username: string; avatarUrl?: string | null }; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || t("profile.saveFailed"));
      toast.success(t(mode === "create" ? "profile.created" : "profile.updated"), { id: loadingId });
      await queryClient.invalidateQueries();
      onSaved?.();
      const target = `/profile/${data.profile.username}`;
      router.replace(target);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("profile.saveFailed"), { id: loadingId });
    } finally {
      setSubmitting(false);
    }
  }

  const status = availability === "checking" ? <><LoaderCircle className="h-4 w-4 animate-spin" /> {t("profile.checking")}</>
    : availability === "available" ? <><CheckCircle2 className="h-4 w-4" /> {t("profile.available")}</>
    : availability === "taken" ? <><XCircle className="h-4 w-4" /> {t("profile.taken")}</>
    : availability === "invalid" ? <><XCircle className="h-4 w-4" /> {t("profile.invalidUsername")}</> : null;

  if (cropSource) return <AvatarCropModal imageUrl={cropSource.url} isGif={cropSource.isGif} onCancel={cancelCrop} onApply={applyCrop}/>;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">{t("profile.photo")}</span>
        <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
          <UserAvatar src={avatarPreview ?? avatarUrl ?? session?.user.image} name={displayName || username || "User"} size={64} textClassName="text-lg" />
          <div className="min-w-0 flex-1">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={submitting} className="sr-only" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={submitting} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-subtle disabled:opacity-50">
                <ImagePlus className="h-4 w-4" />{t("profile.choosePhoto")}
              </button>
              {(avatarBlob || avatarUrl || initial.avatarUrl) && <button type="button" disabled={submitting} onClick={resetAvatar} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text disabled:opacity-50">
                <Trash2 className="h-4 w-4" />{t("profile.resetPhoto")}
              </button>}
            </div>
            <p className="mt-2 text-xs leading-5 text-text-secondary">{t("profile.photoHelp")}</p>
          </div>
        </div>
      </div>
      <label className="block">
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">{t("profile.username")}</span>
        <div className="flex rounded-lg border border-border bg-surface focus-within:border-accent">
          <span className="px-3 py-3 text-text-secondary">@</span>
          <input value={username} disabled={submitting} onChange={(event) => changeUsername(event.target.value)} maxLength={20} autoComplete="username" className="min-w-0 flex-1 bg-transparent py-3 pr-3 outline-none disabled:opacity-60" required />
        </div>
        <span className={`mt-2 flex min-h-5 items-center gap-1.5 text-xs ${availability === "available" ? "text-success-text" : availability === "checking" || availability === "idle" ? "text-text-secondary" : "text-danger-text"}`}>{status}</span>
      </label>
      <label className="block">
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">{t("profile.displayName")}</span>
        <input value={displayName} disabled={submitting} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} required className="w-full rounded-lg border border-border bg-surface px-3 py-3 outline-none focus:border-accent disabled:opacity-60" />
      </label>
      <label className="block">
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">{t("profile.bio")}</span>
        <textarea value={bio} disabled={submitting} onChange={(event) => setBio(event.target.value)} maxLength={160} rows={4} className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-3 outline-none focus:border-accent disabled:opacity-60" />
        <span className="mt-1 block text-right font-mono text-[11px] text-text-secondary">{bio.length}/160</span>
      </label>
      <button type="submit" disabled={availability !== "available" || submitting || !displayName.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-action-primary px-4 py-3 font-semibold text-on-action-primary transition hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
        {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{t(mode === "create" ? "profile.create" : "profile.save")}
      </button>
    </form>
  );
}
