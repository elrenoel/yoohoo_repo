"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  BookOpen,
  Brain,
  CheckCircle2,
  Compass,
  Copy,
  FileText,
  Heart,
  Layers3,
  MessageCircle,
  Repeat2,
  Share2,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { useSession } from "@/lib/session-provider";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

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
    if (!isPending && session?.user) router.replace("/home");
  }, [session, isPending, router]);

  const reveal = mounted
    ? "opacity-100 translate-y-0"
    : "opacity-0 translate-y-8";

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

  const socialFeatures = [
    {
      icon: MessageCircle,
      title: t("landing.socialFeature1Title"),
      desc: t("landing.socialFeature1Desc"),
    },
    {
      icon: Compass,
      title: t("landing.socialFeature2Title"),
      desc: t("landing.socialFeature2Desc"),
    },
    {
      icon: Users,
      title: t("landing.socialFeature3Title"),
      desc: t("landing.socialFeature3Desc"),
    },
    {
      icon: Bookmark,
      title: t("landing.socialFeature4Title"),
      desc: t("landing.socialFeature4Desc"),
    },
  ];

  const deskFeatures = [
    {
      icon: Layers3,
      title: t("landing.deskFeature1Title"),
      desc: t("landing.deskFeature1Desc"),
    },
    {
      icon: BookOpen,
      title: t("landing.deskFeature2Title"),
      desc: t("landing.deskFeature2Desc"),
    },
    {
      icon: Brain,
      title: t("landing.deskFeature3Title"),
      desc: t("landing.deskFeature3Desc"),
    },
    {
      icon: BarChart3,
      title: t("landing.deskFeature4Title"),
      desc: t("landing.deskFeature4Desc"),
    },
  ];

  const steps = [
    {
      num: "01",
      icon: Upload,
      title: t("landing.step1Title"),
      desc: t("landing.step1Desc"),
    },
    {
      num: "02",
      icon: Sparkles,
      title: t("landing.step2Title"),
      desc: t("landing.step2Desc"),
    },
    {
      num: "03",
      icon: CheckCircle2,
      title: t("landing.step3Title"),
      desc: t("landing.step3Desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col text-text selection:bg-action-primary selection:text-on-accent">
      <Navbar />

      {/* Hero */}
      <section className="relative flex flex-col items-center px-6 pt-16 sm:pt-24 pb-0 text-center overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-50"
          src="/make_looping_video_for_backgro.mp4"
        />
        <span
          className={`relative z-10 inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-[13px] font-medium text-text-secondary bg-surface-subtle rounded-full border border-border transition-all duration-500 ${reveal}`}
        >
          <Users className="w-3.5 h-3.5" />
          {t("landing.socialHeroPill")}
        </span>
        <h1
          className={`relative z-10 max-w-[860px] text-[clamp(2.5rem,5.5vw,4.75rem)] font-medium tracking-[-0.03em] leading-[1.06] text-text mb-7 transition-all duration-700 delay-100 ${reveal}`}
        >
          {t("landing.socialHeroTitle1")}
          <br />
          {t("landing.socialHeroTitle2")}
        </h1>
        <p
          className={`relative z-10 max-w-2xl text-base sm:text-lg text-text leading-relaxed mb-9 transition-all duration-700 delay-150 ${reveal}`}
        >
          {t("landing.socialHeroSubtitle")}
        </p>
        <div
          className={`relative z-10 flex flex-col sm:flex-row items-center gap-3 mb-16 transition-all duration-700 delay-200 ${reveal}`}
        >
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium rounded-full bg-action-primary text-on-action-primary transition hover:opacity-90"
          >
            {t("landing.ctaGetStarted")}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium rounded-full border border-border bg-surface/70 text-text backdrop-blur-md transition hover:bg-surface-hover"
          >
            {t("landing.ctaExplore")}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div
          className={`relative z-10 w-full max-w-[1040px] transition-all duration-700 delay-300 ${reveal}`}
        >
          <div className="rounded-t-2xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((dot) => (
                  <div
                    key={dot}
                    className="w-3 h-3 rounded-full bg-skeleton-highlight"
                  />
                ))}
              </div>
              <div className="px-4 py-1 ml-2 text-xs text-text-muted bg-surface-subtle rounded-md">
                yoohoo.my.id
              </div>
            </div>
            <div className="grid md:grid-cols-[1.15fr_0.85fr] min-h-[390px] bg-gradient-to-br from-surface-subtle to-surface text-left">
              <div className="p-6 sm:p-9 border-b md:border-b-0 md:border-r border-border">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-text-muted mb-1">
                      {t("landing.mockupFeedLabel")}
                    </p>
                    <p className="font-semibold">
                      {t("landing.mockupFeedTitle")}
                    </p>
                  </div>
                  <Compass className="w-5 h-5 text-text-muted" />
                </div>
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-action-primary flex items-center justify-center text-xs text-on-action-primary font-semibold">
                      Y
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Yoohoo Learner</p>
                      <p className="text-xs text-text-muted">@yoohoo</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-4">
                    {t("landing.mockupPost")}
                  </p>
                  <div className="rounded-xl border border-border bg-surface-subtle p-4 mb-4">
                    <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                      <Layers3 className="w-3.5 h-3.5" />
                      {t("landing.mockupDeckLabel")}
                    </div>
                    <p className="text-sm font-semibold">
                      {t("landing.mockupDeckTitle")}
                    </p>
                  </div>
                  <div className="flex items-center gap-5 text-text-muted">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Heart className="w-4 h-4" />
                      24
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <MessageCircle className="w-4 h-4" />8
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <Repeat2 className="w-4 h-4" />5
                    </span>
                    <Bookmark className="w-4 h-4 ml-auto" />
                  </div>
                </div>
              </div>
              <div className="p-6 sm:p-9 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-text-muted mb-1">
                      {t("landing.mockupDeskLabel")}
                    </p>
                    <p className="font-semibold">
                      {t("landing.mockupDeskTitle")}
                    </p>
                  </div>
                  <Sparkles className="w-5 h-5 text-text-muted" />
                </div>
                <div className="rounded-2xl border border-dashed border-border-strong p-6 text-center mb-4">
                  <Upload className="w-7 h-7 mx-auto mb-3 text-text-muted" />
                  <p className="text-sm font-medium mb-1">
                    {t("landing.mockupDrop")}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t("landing.socialMockupHint")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <BookOpen className="w-5 h-5 mb-3 text-text-muted" />
                    <p className="text-sm font-semibold">Flashcard</p>
                    <p className="text-xs text-text-muted mt-1">24 cards</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <Brain className="w-5 h-5 mb-3 text-text-muted" />
                    <p className="text-sm font-semibold">Quiz</p>
                    <p className="text-xs text-text-muted mt-1">10 questions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-24 sm:py-28 text-center">
          <span className="inline-block px-3 py-1 mb-5 text-xs font-medium tracking-wide uppercase text-text-muted bg-surface-subtle rounded-full border border-border">
            {t("landing.aboutTag")}
          </span>
          <h2 className="max-w-4xl mx-auto text-3xl sm:text-5xl font-medium tracking-[-0.025em] leading-[1.12] whitespace-pre-line mb-7">
            {t("landing.socialAboutTitle")}
          </h2>
          <p className="max-w-3xl mx-auto text-base sm:text-lg text-text-muted leading-relaxed">
            {t("landing.socialAboutDesc")}
          </p>
        </div>
      </section>

      {/* Social learning */}
      <section className="border-t border-border bg-surface-subtle">
        <div className="max-w-6xl mx-auto px-6 py-24 sm:py-28">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16 items-end mb-14">
            <div>
              <span className="inline-block px-3 py-1 mb-5 text-xs font-medium tracking-wide uppercase text-text-muted bg-surface rounded-full border border-border">
                {t("landing.socialTag")}
              </span>
              <h2 className="text-3xl sm:text-5xl font-medium tracking-[-0.025em] leading-[1.12]">
                {t("landing.socialTitle")}
              </h2>
            </div>
            <div>
              <p className="text-base sm:text-lg text-text-muted leading-relaxed mb-7">
                {t("landing.socialDesc")}
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 text-sm font-semibold text-text hover:gap-3 transition-all"
              >
                {t("landing.ctaExploreYoohoo")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {socialFeatures.map((feature) => (
              <article
                key={feature.title}
                className="group rounded-2xl border border-border bg-surface p-6 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-text text-surface flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {feature.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Your Desk */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-24 sm:py-28">
          <div className="max-w-3xl mx-auto text-center mb-14">
            <span className="inline-block px-3 py-1 mb-5 text-xs font-medium tracking-wide uppercase text-text-muted bg-surface-subtle rounded-full border border-border">
              {t("landing.deskTag")}
            </span>
            <h2 className="text-3xl sm:text-5xl font-medium tracking-[-0.025em] leading-[1.12] mb-6">
              {t("landing.deskTitle")}
            </h2>
            <p className="text-base sm:text-lg text-text-muted leading-relaxed">
              {t("landing.deskDesc")}
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-surface-subtle p-4 sm:p-7 mb-8">
            <div className="grid md:grid-cols-[240px_1fr] rounded-2xl border border-border bg-surface overflow-hidden min-h-[360px]">
              <aside className="p-5 border-b md:border-b-0 md:border-r border-border">
                <p className="text-xs uppercase tracking-wider text-text-muted mb-5">
                  Your Desk
                </p>
                {[
                  t("landing.deskNav1"),
                  t("landing.deskNav2"),
                  t("landing.deskNav3"),
                ].map((item, index) => (
                  <div
                    key={item}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 ${index === 0 ? "bg-surface-subtle font-medium" : "text-text-muted"}`}
                  >
                    {index === 0 ? (
                      <Layers3 className="w-4 h-4" />
                    ) : index === 1 ? (
                      <FileText className="w-4 h-4" />
                    ) : (
                      <BarChart3 className="w-4 h-4" />
                    )}
                    {item}
                  </div>
                ))}
              </aside>
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4 mb-7">
                  <div>
                    <p className="text-xs text-text-muted mb-1">
                      {t("landing.deskMockupLabel")}
                    </p>
                    <p className="text-xl font-semibold">
                      {t("landing.deskMockupTitle")}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-action-primary text-on-action-primary text-xs font-medium">
                    <Upload className="w-3.5 h-3.5" />
                    {t("landing.deskMockupButton")}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[t("landing.deskDeck1"), t("landing.deskDeck2")].map(
                    (deck, index) => (
                      <div
                        key={deck}
                        className="rounded-2xl border border-border p-5"
                      >
                        <div className="flex items-start justify-between mb-9">
                          <div className="w-10 h-10 rounded-xl bg-text text-surface flex items-center justify-center">
                            {index === 0 ? (
                              <Brain className="w-5 h-5" />
                            ) : (
                              <BookOpen className="w-5 h-5" />
                            )}
                          </div>
                          <span className="text-xs text-text-muted">
                            {index === 0 ? "24 cards" : "18 cards"}
                          </span>
                        </div>
                        <p className="font-semibold mb-1">{deck}</p>
                        <p className="text-xs text-text-muted">
                          Flashcard & Quiz
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {deskFeatures.map((feature) => (
              <article key={feature.title} className="p-5">
                <feature.icon className="w-5 h-5 text-text-muted mb-4" />
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {feature.desc}
                </p>
              </article>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-action-primary text-on-action-primary text-sm font-medium transition hover:opacity-90"
            >
              {t("landing.ctaOpenDesk")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface-subtle">
        <div className="max-w-6xl mx-auto px-6 py-24 sm:py-28">
          <div className="max-w-3xl mb-14">
            <span className="inline-block px-3 py-1 mb-5 text-xs font-medium tracking-wide uppercase text-text-muted bg-surface rounded-full border border-border">
              {t("landing.stepsTag")}
            </span>
            <h2 className="text-3xl sm:text-5xl font-medium tracking-[-0.025em] leading-[1.12] mb-5">
              {t("landing.stepsTitle")}
            </h2>
            <p className="text-base sm:text-lg text-text-muted leading-relaxed">
              {t("landing.stepsDesc")}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-px rounded-3xl border border-border bg-border overflow-hidden">
            {steps.map((step) => (
              <article
                key={step.num}
                className="bg-surface p-7 sm:p-9 min-h-[300px] flex flex-col"
              >
                <div className="flex items-center justify-between mb-16">
                  <span className="text-sm font-semibold text-text-muted">
                    {step.num}
                  </span>
                  <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center">
                    <step.icon className="w-4.5 h-4.5" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {step.desc}
                </p>
              </article>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-sm font-semibold hover:gap-3 transition-all"
            >
              {t("landing.ctaStartLearning")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Share decks */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-24 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1 rounded-3xl border border-border bg-surface-subtle p-5 sm:p-8">
              <div className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-start justify-between gap-4 mb-10">
                  <div className="w-11 h-11 rounded-xl bg-text text-surface flex items-center justify-center">
                    <Brain className="w-5 h-5" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-surface-subtle border border-border text-xs text-text-muted">
                    {t("landing.sharePublic")}
                  </span>
                </div>
                <p className="text-xl font-semibold mb-2">
                  {t("landing.shareDeckTitle")}
                </p>
                <p className="text-sm text-text-muted mb-7">
                  {t("landing.shareDeckMeta")}
                </p>
                <div className="flex flex-wrap gap-2 mb-7">
                  {["Machine Learning", "AI", "Neural Network"].map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-full border border-border text-xs text-text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-5 border-t border-border">
                  <span className="inline-flex items-center gap-2 text-xs text-text-muted">
                    <Users className="w-4 h-4" />
                    128 {t("landing.shareLearners")}
                  </span>
                  <span className="inline-flex items-center gap-2 ml-auto text-xs font-medium">
                    <Copy className="w-4 h-4" />
                    {t("landing.shareFork")}
                  </span>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-block px-3 py-1 mb-5 text-xs font-medium tracking-wide uppercase text-text-muted bg-surface-subtle rounded-full border border-border">
                {t("landing.shareTag")}
              </span>
              <h2 className="text-3xl sm:text-5xl font-medium tracking-[-0.025em] leading-[1.12] mb-6">
                {t("landing.shareTitle")}
              </h2>
              <p className="text-base sm:text-lg text-text-muted leading-relaxed mb-8">
                {t("landing.shareDesc")}
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-border text-sm font-medium transition hover:bg-surface-hover"
              >
                {t("landing.ctaFindDecks")}
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-surface px-6 py-10 sm:py-16">
        <div className="relative max-w-6xl mx-auto rounded-3xl bg-text text-surface overflow-hidden px-6 py-16 sm:px-12 sm:py-20 text-center">
          <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-surface via-transparent to-surface" />
          <div className="relative z-10">
            <Share2 className="w-7 h-7 mx-auto mb-6 opacity-70" />
            <h2 className="max-w-3xl mx-auto text-3xl sm:text-5xl font-medium tracking-[-0.025em] leading-[1.12] mb-6">
              {t("landing.finalTitle")}
            </h2>
            <p className="max-w-2xl mx-auto text-sm sm:text-base opacity-70 leading-relaxed mb-9">
              {t("landing.finalDesc")}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-surface text-text text-sm font-medium transition hover:opacity-90"
              >
                {t("landing.ctaCreateAccount")}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/desk/demo"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-surface/30 text-surface text-sm font-medium transition hover:bg-surface/10"
              >
                {t("landing.ctaSeeDemo")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
