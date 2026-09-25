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

/**
 * Landing page — shown to unauthenticated visitors.
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
      router.replace("/app");
    }
  }, [session, isPending, router]);

  if (isPending || session?.user) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar />

      {/* ═══════════════════════════════════════════════════════════════
          HERO — Ando-style: pill tag, serif headline, CTA, mockup
      ═══════════════════════════════════════════════════════════════ */}
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
        <div className="absolute inset-0 bg-white/20 z-0" />

        {/* Pill tag */}
        <Link
          href="/documents/demo-os-memory/flashcards"
          className={`relative z-10 inline-flex items-center gap-1.5 px-4 py-1.5 mb-8 text-[13px] font-medium text-neutral-600 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-all duration-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          {t("landing.heroPill")}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>

        {/* Main headline — serif-style, large, centered */}
        <h1
          className={`relative z-10 max-w-[720px] text-[clamp(2.5rem,5.5vw,4.5rem)] font-medium tracking-[-0.02em] leading-[1.1] text-neutral-900 mb-8 transition-all duration-700 delay-100 ${
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
            style={{ backgroundColor: '#041914', color: '#FDF7EB' }}
          >
            {t("landing.ctaGetStarted")}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/documents/demo-os-memory/flashcards"
            className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium rounded-full border backdrop-blur-md transition hover:bg-white/40"
            style={{ borderColor: '#013528', color: '#013528', backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            {t("landing.ctaSeeDemo")}
          </Link>
        </div>

        {/* App mockup — rounded card with fake UI */}
        <div
          className={`relative z-10 w-full max-w-[960px] transition-all duration-700 delay-300 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <div className="relative rounded-t-2xl rounded-b-0 border border-neutral-200 bg-white shadow-2xl shadow-neutral-200/50 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-neutral-200" />
                <div className="w-3 h-3 rounded-full bg-neutral-200" />
                <div className="w-3 h-3 rounded-full bg-neutral-200" />
              </div>
              <div className="flex-1 flex">
                <div className="px-4 py-1 text-xs text-neutral-400 bg-neutral-50 rounded-md">
                  yoohoo.my.id
                </div>
              </div>
            </div>
            {/* Fake app content */}
            <div className="p-6 sm:p-10 bg-gradient-to-br from-neutral-50 to-white min-h-[320px] sm:min-h-[420px] flex flex-col items-center justify-center gap-6">
              {/* Upload area mockup */}
              <div className="w-full max-w-md border-2 border-dashed border-neutral-200 rounded-xl p-8 text-center">
                <Upload className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-neutral-500 mb-1">
                  {t("landing.mockupDrop")}
                </p>
                <p className="text-xs text-neutral-400">
                  {t("landing.mockupHint")}
                </p>
              </div>
              {/* Fake flashcard previews */}
              <div className="flex gap-3 w-full max-w-md">
                <div className="flex-1 h-20 rounded-lg bg-white border border-neutral-200 p-3 flex flex-col justify-between">
                  <div className="w-16 h-2 rounded bg-neutral-200" />
                  <div className="w-24 h-2 rounded bg-neutral-100" />
                </div>
                <div className="flex-1 h-20 rounded-lg bg-white border border-neutral-200 p-3 flex flex-col justify-between">
                  <div className="w-20 h-2 rounded bg-neutral-200" />
                  <div className="w-14 h-2 rounded bg-neutral-100" />
                </div>
                <div className="flex-1 h-20 rounded-lg bg-white border border-neutral-200 p-3 flex flex-col justify-between">
                  <div className="w-12 h-2 rounded bg-neutral-200" />
                  <div className="w-20 h-2 rounded bg-neutral-100" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 — About the App
      ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          {/* Section header */}
          <div
            className={`max-w-3xl mx-auto text-center mb-16 transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-block px-3 py-1 mb-4 text-xs font-medium tracking-wide uppercase text-neutral-500 bg-neutral-100 rounded-full border border-neutral-200">
              {t("landing.aboutTag")}
            </span>
            <h2 className="text-3xl sm:text-5xl font-medium tracking-[-0.02em] text-neutral-900 leading-[1.15] whitespace-pre-line mb-6">
              {t("landing.aboutTitle")}
            </h2>
            <p className="text-base sm:text-lg text-neutral-500 leading-relaxed max-w-2xl mx-auto">
              {t("landing.aboutDesc")}
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Upload, title: t("landing.feature1Title"), desc: t("landing.feature1Desc"), delay: "delay-100", cardBg: '#fff', iconBg: '#111', iconColor: '#fff', textColor: '#111', descColor: '#111' },
              { icon: BookOpen, title: t("landing.feature2Title"), desc: t("landing.feature2Desc"), delay: "delay-200", cardBg: '#fff', iconBg: '#111', iconColor: '#fff', textColor: '#111', descColor: '#111' },
              { icon: Brain, title: t("landing.feature3Title"), desc: t("landing.feature3Desc"), delay: "delay-300", cardBg: '#fff', iconBg: '#111', iconColor: '#fff', textColor: '#111', descColor: '#111' },
              { icon: BarChart3, title: t("landing.feature4Title"), desc: t("landing.feature4Desc"), delay: "delay-[400ms]", cardBg: '#fff', iconBg: '#111', iconColor: '#fff', textColor: '#111', descColor: '#111' },
            ].map((feature) => (
              <div
                key={feature.title}
                className={`group p-6 rounded-2xl hover:shadow-lg transition-all duration-500 ${feature.delay} ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ backgroundColor: feature.cardBg, border: '1px solid rgba(0,0,0,0.06)' }}
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

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3 — How It Works
      ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-100">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div
            className={`text-center mb-16 transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-neutral-900 mb-4">
              {t("upload.title")}
            </h2>
            <p className="text-neutral-500 max-w-xl mx-auto">
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
                <span className="inline-block text-5xl font-bold text-neutral-200 mb-4">
                  {step.num}
                </span>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-xs mx-auto">
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
              style={{ backgroundColor: '#041914', color: '#FDF7EB' }}
            >
              {t("landing.ctaGetStarted")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
