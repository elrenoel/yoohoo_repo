"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProfileForm from "@/components/profile/ProfileForm";
import { useSession } from "@/lib/session-provider";
import { useI18n } from "@/lib/i18n";
import { useOwnProfile } from "@/hooks/use-own-profile";

export default function UsernameOnboardingPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const { t } = useI18n();
  const profile = useOwnProfile();

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) { router.replace("/login"); return; }
    if (profile.data?.profile) router.replace(`/profile/${profile.data.profile.username}`);
  }, [isPending, profile.data?.profile, router, session?.user]);

  if (isPending || profile.isPending || !session?.user || profile.data?.profile) return <OnboardingSkeleton />;
  return (
    <main className="min-h-screen bg-bg px-5 py-12 text-text">
      <div className="mx-auto max-w-xl border border-border bg-surface p-6 sm:p-10">
        <div className="mb-8 border-l-2 border-danger pl-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">{t("profile.onboardingLabel")}</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold">{t("profile.chooseUsername")}</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{t("profile.onboardingDescription")}</p>
        </div>
        <ProfileForm mode="create" initial={{ displayName: session.user.name || "" }} />
      </div>
    </main>
  );
}

function OnboardingSkeleton() {
  return <main className="min-h-screen bg-bg px-5 py-12"><div className="mx-auto max-w-xl animate-pulse border border-border bg-surface p-10"><div className="h-4 w-28 bg-skeleton" /><div className="mt-4 h-10 w-3/4 bg-skeleton" /><div className="mt-10 space-y-6">{[1,2,3].map((item) => <div key={item}><div className="mb-2 h-3 w-20 bg-skeleton" /><div className="h-12 bg-skeleton" /></div>)}</div></div></main>;
}
