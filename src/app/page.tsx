"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Upload,
  BookOpen,
  Brain,
  BarChart3,
} from "lucide-react";
import { useSession } from "@/lib/session-provider";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

/**
 * Landing page â€” shown to unauthenticated visitors.
 * Ando-inspired hero + about section.
 */
export default function LandingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, isPending } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPending && session?.user) {
      router.replace("/desk");
    }
  }, [session, isPending, router]);

  if (isPending || session?.user) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col text-text selection:bg-action-primary selection:text-on-accent">
      <Navbar />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          HERO â€” Ando-style: pill tag, serif headline, CTA, mockup
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="relative flex flex-col items-center px-6 pt-16 sm:pt-24 pb-0 text-center overflow-hidden">
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
          src="/make_looping_video_for_backgro.mp4"
        />
        {/* Overlay for readability */}
        <div className="absolute inset-0 z-0 bg-overlay" />

        {/* Pill tag */}
        <Link
          href="/desk/demo"
          className={`relative z-10 inline-flex items-center gap-1.5 px-4 py-1.5 mb-8 text-[13px] font-medium text-text-secondary bg-surface-subtle rounded-full hover:bg-skeleton-highlight transition-all duration-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          {t("landing.heroPill")}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>

        {/* Main headline â€” serif-style, large, centered */}
        <h1
          className={`relative z-10 max-w-[720px] text-[clamp(2.5rem,5.5vw,4.5rem)] font-medium tracking-[-0.02em] leading-[1.1] text-text mb-8 transition-all duration-700 delay-100 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {t("landing.heroTitle1")}
          <br />
          {t("landing.heroTitle2")}
        </h1>

        {/* CTA buttons */}
        <div
          className={`relative z-10 flex flex-col sm:flex-row items-center gap-3 mb-16 transition-all duration-700 delay-200 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium rounded-full transition"
            style={{ backgroundColor: 'var(--action-primary)', color: 'var(--on-action-primary)' }}
          >
            {t("landing.ctaGetStarted")}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/desk/demo"
            className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium rounded-full border backdrop-blur-md transition hover:bg-surface-hover/40"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-subtle)' }}
          >
            {t("landing.ctaSeeDemo")}
          </Link>
        </div>

        {/* App mockup â€” rounded card with fake UI */}
        <div
          className={`relative z-10 w-full max-w-[960px] transition-all duration-700 delay-300 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <div className="relative rounded-t-2xl rounded-b-0 border border-border bg-surface shadow-2xl shadow-none overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-skeleton-highlight" />
                <div className="w-3 h-3 rounded-full bg-skeleton-highlight" />
                <div className="w-3 h-3 rounded-full bg-skeleton-highlight" />
              </div>
              <div className="flex-1 flex">
                <div className="px-4 py-1 text-xs text-text-muted bg-surface-subtle rounded-md">
                  yoohoo.my.id
                </div>
              </div>
            </div>
            {/* Fake app content */}
            <div className="p-6 sm:p-10 bg-gradient-to-br from-surface-subtle to-surface min-h-[320px] sm:min-h-[420px] flex flex-col items-center justify-center gap-6">
              {/* Upload area mockup */}
              <div className="w-full max-w-md border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Upload className="w-10 h-10 text-text-secondary mx-auto mb-3" />
                <p className="text-sm font-medium text-text-muted mb-1">
                  {t("landing.mockupDrop")}
                </p>
                <p className="text-xs text-text-muted">
                  {t("landing.mockupHint")}
                </p>
              </div>
              {/* Fake flashcard previews */}
              <div className="flex gap-3 w-full max-w-md">
                <div className="flex-1 h-20 rounded-lg bg-surface border border-border p-3 flex flex-col justify-between">
                  <div className="w-16 h-2 rounded bg-skeleton-highlight" />
                  <div className="w-24 h-2 rounded bg-surface-subtle" />
                </div>
                <div className="flex-1 h-20 rounded-lg bg-surface border border-border p-3 flex flex-col justify-between">
                  <div className="w-20 h-2 rounded bg-skeleton-highlight" />
                  <div className="w-14 h-2 rounded bg-surface-subtle" />
                </div>
                <div className="flex-1 h-20 rounded-lg bg-surface border border-border p-3 flex flex-col justify-between">
                  <div className="w-12 h-2 rounded bg-skeleton-highlight" />
                  <div className="w-20 h-2 rounded bg-surface-subtle" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SECTION 2 â€” About the App
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-24">
          {/* Section header */}
          <div
            className={`max-w-3xl mx-auto text-center mb-16 transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-block px-3 py-1 mb-4 text-xs font-medium tracking-wide uppercase text-text-muted bg-surface-subtle rounded-full border border-border">
              {t("landing.aboutTag")}
            </span>
            <h2 className="text-3xl sm:text-5xl font-medium tracking-[-0.02em] text-text leading-[1.15] whitespace-pre-line mb-6">
              {t("landing.aboutTitle")}
            </h2>
            <p className="text-base sm:text-lg text-text-muted leading-relaxed max-w-2xl mx-auto">
              {t("landing.aboutDesc")}
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Upload, title: t("landing.feature1Title"), desc: t("landing.feature1Desc"), delay: "delay-100", cardBg: 'var(--surface)', iconBg: 'var(--text)', iconColor: 'var(--surface)', textColor: 'var(--text)', descColor: 'var(--text)' },
              { icon: BookOpen, title: t("landing.feature2Title"), desc: t("landing.feature2Desc"), delay: "delay-200", cardBg: 'var(--surface)', iconBg: 'var(--text)', iconColor: 'var(--surface)', textColor: 'var(--text)', descColor: 'var(--text)' },
              { icon: Brain, title: t("landing.feature3Title"), desc: t("landing.feature3Desc"), delay: "delay-300", cardBg: 'var(--surface)', iconBg: 'var(--text)', iconColor: 'var(--surface)', textColor: 'var(--text)', descColor: 'var(--text)' },
              { icon: BarChart3, title: t("landing.feature4Title"), desc: t("landing.feature4Desc"), delay: "delay-[400ms]", cardBg: 'var(--surface)', iconBg: 'var(--text)', iconColor: 'var(--surface)', textColor: 'var(--text)', descColor: 'var(--text)' },
            ].map((feature) => (
              <div
                key={feature.title}
                className={`group p-6 rounded-2xl hover:shadow-lg transition-all duration-500 ${feature.delay} ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ backgroundColor: feature.cardBg, border: '1px solid var(--border)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: feature.iconBg }}>
                  <feature.icon className="w-5 h-5" style={{ color: feature.iconColor }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: feature.textColor }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: feature.descColor }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SECTION 3 â€” How It Works
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div
            className={`text-center mb-16 transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-text mb-4">
              {t("upload.title")}
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              {t("upload.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: "01", title: t("steps.1Title"), desc: t("steps.1Desc"), delay: "delay-100" },
              { num: "02", title: t("steps.2Title"), desc: t("steps.2Desc"), delay: "delay-200" },
              { num: "03", title: t("steps.3Title"), desc: t("steps.3Desc"), delay: "delay-300" },
            ].map((step) => (
              <div
                key={step.num}
                className={`text-center transition-all duration-500 ${step.delay} ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              >
                <span className="inline-block text-5xl font-bold text-text-muted mb-4">
                  {step.num}
                </span>
                <h3 className="text-lg font-semibold text-text mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed max-w-xs mx-auto">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div
            className={`text-center mt-14 transition-all duration-700 delay-500 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 text-sm font-medium rounded-full transition"
              style={{ backgroundColor: 'var(--action-primary)', color: 'var(--on-action-primary)' }}
            >
              {t("landing.ctaGetStarted")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
