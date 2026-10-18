"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { meetsPasswordRequirements, PASSWORD_RULES } from "@/lib/password-rules";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

function ResetPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : t("auth.passwordResetInvalid"));
  const [complete, setComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (!meetsPasswordRequirements(password)) {
      setError(t("auth.passwordRequirementError", { min: PASSWORD_RULES.minLength }));
      return;
    }
    if (password !== confirmation) {
      setError(t("auth.confirmPasswordMismatch"));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error.message || t("auth.passwordResetFailed"));
      return;
    }
    setComplete(true);
    window.setTimeout(() => router.replace("/login?message=password-reset"), 1200);
  };

  const passwordInput = (id: string, value: string, onChange: (value: string) => void, visible: boolean, toggle: () => void, label: string) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</label>
      <div className="relative">
        <input id={id} type={visible ? "text" : "password"} required autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} placeholder="••••••••••" disabled={isSubmitting || complete} className="w-full rounded-xl border border-control-border bg-surface-subtle px-3.5 py-2.5 pr-11 text-sm text-text transition disabled:opacity-50" />
        <button type="button" onClick={toggle} aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")} aria-pressed={visible} disabled={isSubmitting || complete} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-muted transition hover:text-text disabled:opacity-50">
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );

  return (
    <Card>
      <div className="mb-6 text-center">
        <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-text">{t("auth.resetPasswordTitle")}</h1>
        <p className="text-xs text-text-muted">{t("auth.resetPasswordSubtitle")}</p>
      </div>
      {complete ? <div className="rounded-xl border border-success-border bg-success-subtle p-4 text-center text-sm text-success-text"><CheckCircle2 className="mx-auto mb-2 h-5 w-5" />{t("auth.passwordResetSuccess")}</div> : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-subtle p-3.5 text-xs text-danger-text"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          {passwordInput("password", password, setPassword, showPassword, () => setShowPassword((visible) => !visible), t("auth.passwordLabel"))}
          {passwordInput("confirmation", confirmation, setConfirmation, showConfirmation, () => setShowConfirmation((visible) => !visible), t("auth.confirmPasswordLabel"))}
          <p className="text-[11px] text-text-muted">{t("auth.passwordRequirementHint", { min: PASSWORD_RULES.minLength })}</p>
          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting || !token} className="w-full">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.resetPassword")}</Button>
        </form>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  return <div className="min-h-screen bg-bg text-text"><Navbar rightContent={<Link href="/login" className="text-xs font-medium text-chrome-text">{t("auth.backToLogin")}</Link>} /><main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-md items-center px-6 py-12"><Suspense fallback={<Loader2 className="mx-auto h-6 w-6 animate-spin text-text-muted" />}><ResetPasswordForm /></Suspense></main></div>;
}
