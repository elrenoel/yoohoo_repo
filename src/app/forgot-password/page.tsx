"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error.message || t("auth.passwordResetFailed"));
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <Navbar rightContent={<Link href="/login" className="text-xs font-medium text-chrome-text">{t("auth.backToLogin")}</Link>} />
      <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-md items-center px-6 py-12">
        <Card>
          <div className="mb-6 text-center">
            <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-text">{t("auth.forgotPasswordTitle")}</h1>
            <p className="text-xs text-text-muted">{t("auth.forgotPasswordSubtitle")}</p>
          </div>

          {sent ? (
            <div className="rounded-xl border border-success-border bg-success-subtle p-4 text-center text-sm text-success-text">
              <CheckCircle2 className="mx-auto mb-2 h-5 w-5" />
              <p>{t("auth.passwordResetSent")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-subtle p-3.5 text-xs text-danger-text"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-text-secondary">{t("auth.emailLabel")}</label>
                <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@kampus.ac.id" disabled={isSubmitting} className="w-full rounded-xl border border-control-border bg-surface-subtle px-3.5 py-2.5 text-sm text-text transition disabled:opacity-50" />
              </div>
              <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{t("auth.sendPasswordReset")}</span><ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
