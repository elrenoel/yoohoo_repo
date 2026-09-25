"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { useSession } from "@/lib/session-provider";
import { useI18n } from "@/lib/i18n";
import { ArrowRight, AlertCircle, Loader2, Info } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { invalidate: invalidateSession } = useSession();
  const noticeMessage = searchParams.get("message");
  const googleError = searchParams.get("google_error");
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trialLimitNotice, setTrialLimitNotice] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/app",
        errorCallbackURL: "/login",
      });
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : t("auth.googleFailed")
      );
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage(t("auth.emailPasswordRequired"));
      return;
    }

    setIsLoading(true);

    try {
      const res = await signIn.email({
        email: email.trim(),
        password,
      });

      if (res.error) {
        setErrorMessage(
          res.error.message || t("auth.emailPasswordWrong")
        );
        setIsLoading(false);
        return;
      }

      if (typeof window !== "undefined") {
        const rawTrial = localStorage.getItem("yoohoo_trial_data");
        if (rawTrial) {
          try {
            const trialPayload = JSON.parse(rawTrial);
            const saveRes = await fetch("/api/documents/save-trial", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(trialPayload),
            });

            if (saveRes.status === 429) {
              // Limit tercapai — JANGAN hapus localStorage
              setTrialLimitNotice(true);
              setIsLoading(false);
              return;
            }

            if (saveRes.ok) {
              const saveData = await saveRes.json();
              localStorage.removeItem("yoohoo_trial_data");
              localStorage.removeItem("yoohoo_has_used_trial");
              router.push(`/documents/${saveData.documentId}/flashcards`);
              router.refresh();
              return;
            }
          } catch (migrateErr) {
            console.error("Trial migration error:", migrateErr);
          }
        }
      }

      invalidateSession();
      router.push("/app");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : t("auth.loginError")
      );
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mb-1.5">
          {t("auth.loginTitle")}
        </h1>
        <p className="text-xs text-neutral-500">
          {t("auth.loginSubtitle")}
        </p>
      </div>

      {noticeMessage && (
        <div className="mb-6 flex items-start gap-2.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {googleError === "already_registered" && (
        <div className="mb-6 flex items-start gap-2.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
          <span>{t("auth.alreadyRegistered")}</span>
        </div>
      )}

      {oauthError && googleError !== "already_registered" && (
        <div className="mb-6 flex items-start gap-2.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t("auth.googleLoginFailed")}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 flex items-start gap-2.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {trialLimitNotice && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-amber-900">{t("trial.limitReachedTitle")}</p>
              <p className="text-xs text-amber-700">{t("trial.limitReachedMessage")}</p>
              <p className="text-[11px] text-amber-600">{t("trial.limitReachedHint")}</p>
            </div>
          </div>
          <button
            onClick={() => setTrialLimitNotice(false)}
            className="mt-3 text-[11px] text-amber-700 font-medium underline underline-offset-2 hover:text-amber-900 transition cursor-pointer"
          >
            OK
          </button>
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={handleGoogleSignIn}
        disabled={isLoading || isGoogleLoading}
        className="w-full"
      >
        {isGoogleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
        )}
        <span>{t("auth.googleContinue")}</span>
      </Button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase">
          <span className="bg-white px-3 text-neutral-400 font-mono">
            {t("auth.orEmail")}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-neutral-700 mb-1.5">
            {t("auth.emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@kampus.ac.id"
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-neutral-700 mb-1.5">
            {t("auth.passwordLabel")}
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition disabled:opacity-50"
          />
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t("auth.verifying")}</span>
              </>
            ) : (
              <>
                <span>{t("auth.loginButton")}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-neutral-100 text-center text-xs text-neutral-500">
        <span>{t("auth.noAccount")}</span>
        <Link
          href="/register"
          className="font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-700 transition"
        >
          {t("auth.signUpNow")}
        </Link>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar
        rightContent={
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium transition"
            style={{ color: '#FDF7EB' }}
          >
            <span>{t("auth.backToHome")}</span>
          </Link>
        }
      />

      <main className="max-w-md mx-auto px-6 py-12 flex-1 w-full flex flex-col justify-center">
        <Suspense
          fallback={
            <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-500 mb-2" />
              <p className="text-xs text-neutral-500">{t("auth.loadingForm")}</p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>

    </div>
  );
}
