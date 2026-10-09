"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp, signIn } from "@/lib/auth-client";
import { useSession } from "@/lib/session-provider";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Check,
  Info,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULES = {
  minLength: 8,
  hasLetter: /[a-zA-Z]/,
  hasNumber: /[0-9]/,
};

function validateEmail(email: string, t: (key: TranslationKey) => string): string | null {
  if (!email.trim()) return t("auth.emailRequired");
  if (!EMAIL_REGEX.test(email.trim())) return t("auth.emailInvalid");
  return null;
}

function validatePassword(password: string, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string | null {
  if (!password) return t("auth.pwRequired");
  if (password.length < PASSWORD_RULES.minLength)
    return t("auth.pwMinChars", { min: PASSWORD_RULES.minLength });
  if (!PASSWORD_RULES.hasLetter.test(password)) return t("auth.pwNeedsLetter");
  if (!PASSWORD_RULES.hasNumber.test(password)) return t("auth.pwNeedsNumber");
  return null;
}

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 transition-colors duration-200 ${met ? "text-success-text" : "text-text-muted"}`}>
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-all duration-300 ${met ? "border-success-border bg-success-subtle" : "border-border bg-surface-subtle"}`}
      >
        {met && <Check style={{ width: 8, height: 8, strokeWidth: 3 }} />}
      </span>
      <span className="text-[11px] leading-none">{label}</span>
    </span>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { invalidate: invalidateSession } = useSession();

  const googleNotice = searchParams.get("google_error");
  const googleEmail = searchParams.get("email") ?? "";
  const googleName = searchParams.get("name") ?? "";

  const [name, setName] = useState(googleName);
  const [email, setEmail] = useState(googleEmail);
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trialLimitNotice, setTrialLimitNotice] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= PASSWORD_RULES.minLength,
      hasLetter: PASSWORD_RULES.hasLetter.test(password),
      hasNumber: PASSWORD_RULES.hasNumber.test(password),
    }),
    [password]
  );

  const isPasswordValid =
    passwordChecks.length && passwordChecks.hasLetter && passwordChecks.hasNumber;
  const showPasswordHints = passwordTouched && password.length > 0;

  const emailError = emailTouched ? validateEmail(email, t) : null;

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/desk",
        newUserCallbackURL: "/desk",
        requestSignUp: true,
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

    if (!name.trim()) {
      setErrorMessage(t("auth.nameRequired"));
      return;
    }

    const emailErr = validateEmail(email, t);
    if (emailErr) {
      setEmailTouched(true);
      setErrorMessage(emailErr);
      return;
    }

    const pwErr = validatePassword(password, t);
    if (pwErr) {
      setPasswordTouched(true);
      setErrorMessage(pwErr);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t("auth.confirmPasswordMismatch"));
      return;
    }

    setIsLoading(true);

    try {
      const res = await signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (res.error) {
        setErrorMessage(
          res.error.message || t("auth.registerError")
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
              router.push(`/desk/${saveData.documentId}/flashcards`);
              router.refresh();
              return;
            }
          } catch (migrateErr) {
            console.error("Trial migration error:", migrateErr);
          }
        }
      }

      invalidateSession();
      router.push("/desk");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : t("auth.registerError")
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between text-text">
      <Navbar
        rightContent={
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium transition"
            style={{ color: "var(--chrome-text)" }}
          >
            <span>{t("auth.backToHome")}</span>
          </Link>
        }
      />

      <main className="max-w-md mx-auto px-6 py-12 flex-1 w-full flex flex-col justify-center">
        <Card>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-text mb-1.5">
              {t("auth.registerTitle")}
            </h1>
            <p className="text-xs text-text-muted">
              {t("auth.registerSubtitle")}
            </p>
          </div>

          {googleNotice === "not_registered" && (
            <div className="mb-6 flex items-start gap-2.5 text-xs text-warning-text bg-warning-subtle border border-warning-border p-3.5 rounded-xl">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t("auth.googleNotRegistered")}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 flex items-start gap-2.5 text-xs text-danger-text bg-danger-subtle border border-danger-border p-3.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {trialLimitNotice && (
            <div className="mb-6 bg-warning-subtle border border-warning-border rounded-xl p-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-warning-text" />
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-warning-text">{t("trial.limitReachedTitle")}</p>
                  <p className="text-xs text-warning-text">{t("trial.limitReachedMessage")}</p>
                  <p className="text-[11px] text-warning-text opacity-80">{t("trial.limitReachedHint")}</p>
                </div>
              </div>
              <button
                onClick={() => setTrialLimitNotice(false)}
                className="mt-3 text-[11px] text-warning-text font-medium underline underline-offset-2 transition cursor-pointer"
              >
                OK
              </button>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleGoogleSignUp}
            disabled={isLoading || isGoogleLoading}
            className="w-full"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="var(--google-blue)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="var(--google-green)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="var(--google-yellow)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="var(--google-red)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>{t("auth.googleSignUp")}</span>
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-surface px-3 text-text-muted font-mono">
                {t("auth.orEmail")}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-text-secondary mb-1.5">
                {t("auth.fullNameLabel")}
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Reno Pratama"
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-control-border bg-surface-subtle text-text text-sm transition disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1.5">
                {t("auth.emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailTouched) setErrorMessage(null);
                }}
                onBlur={() => setEmailTouched(true)}
                placeholder="nama@kampus.ac.id"
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-surface-subtle text-text text-sm transition disabled:opacity-50 ${
                  emailError
                    ? "border-danger"
                    : "border-control-border"
                }`}
              />
              {emailError && (
                <p className="mt-1.5 text-[11px] text-danger-text flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-text-secondary mb-1.5">
                {t("auth.passwordLabel")}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (!passwordTouched) setPasswordTouched(true);
                }}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-control-border bg-surface-subtle text-text text-sm transition disabled:opacity-50"
              />

              <div
                className="overflow-hidden transition-all duration-300"
                style={{
                  maxHeight: showPasswordHints ? 64 : 0,
                  opacity: showPasswordHints ? 1 : 0,
                  marginTop: showPasswordHints ? 8 : 0,
                }}
              >
                <div className="flex flex-wrap gap-x-4 gap-y-2 px-0.5">
                  <PasswordRule met={passwordChecks.length} label={t("auth.pwMinLength")} />
                  <PasswordRule met={passwordChecks.hasLetter} label={t("auth.pwHasLetter")} />
                  <PasswordRule met={passwordChecks.hasNumber} label={t("auth.pwHasNumber")} />
                </div>
              </div>

              {!showPasswordHints && !password && (
                <p className="mt-1.5 text-[11px] text-text-muted">
                  {t("auth.pwHint")}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-text-secondary mb-1.5">
                {t("auth.confirmPasswordLabel")}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-surface-subtle text-text text-sm transition disabled:opacity-50 ${
                  confirmPassword && confirmPassword !== password
                    ? "border-danger"
                    : "border-control-border"
                }`}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1.5 text-[11px] text-danger-text flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {t("auth.confirmPasswordMismatch")}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={
                  isLoading ||
                  !isPasswordValid ||
                  (!!confirmPassword && confirmPassword !== password)
                }
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t("auth.registering")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("auth.registerButton")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center text-xs text-text-muted">
            <span>{t("auth.hasAccount")}</span>
            <Link
              href="/login"
              className="font-medium text-text underline underline-offset-4 hover:text-text-secondary transition"
            >
              {t("auth.loginHere")}
            </Link>
          </div>
        </Card>
      </main>

    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg flex items-center justify-center text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
