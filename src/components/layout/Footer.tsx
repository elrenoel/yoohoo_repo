"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";
import { ArrowUpRight } from "lucide-react";

/**
 * Faizur-inspired footer with huge bold brand text clipped at the bottom.
 * Semua warna teks di dalam card diwarisi dari `text-footer-text`.
 */
export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer>
      <div className="max-w-300 mx-auto px-4 py-4">
        <div className="bg-accent rounded-4xl overflow-hidden text-footer-text">
          {/* Top content area */}
          <div className="px-8 sm:px-12 pt-10 pb-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-6">
              {/* Brand description */}
              <div className="lg:col-span-4">
                <p className="text-[15px] leading-snug max-w-55">
                  {t("footer.brandDesc")}
                </p>
              </div>

              {/* Explore links */}
              <div className="lg:col-span-2">
                <h4 className="text-sm font-semibold mb-3">
                  {t("footer.explore")}
                </h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="/desk" className="text-sm transition-colors">
                      {t("footer.linkUpload")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/desk/demo"
                      className="text-sm transition-colors"
                    >
                      {t("footer.linkDemo")}
                    </Link>
                  </li>
                  <li>
                    <a href="#" className="text-sm transition-colors">
                      {t("footer.linkBlog")}
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm transition-colors">
                      {t("footer.linkContact")}
                    </a>
                  </li>
                </ul>
              </div>

              {/* Right side: CTA + Courses */}
              <div className="lg:col-span-3">
                <div className="mb-5">
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 text-[22px] font-bold hover:opacity-80 transition-opacity"
                  >
                    {t("footer.ctaTitle")}
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-footer-text text-accent">
                      <ArrowUpRight className="w-4 h-4" />
                    </span>
                  </a>
                  <p className="text-sm mt-0.5 opacity-60">
                    {t("footer.ctaSubtitle")}
                  </p>
                </div>
                <div>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 text-[22px] font-bold hover:opacity-80 transition-opacity"
                  >
                    {t("footer.coursesTitle")}
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-chrome text-accent border border-footer-text">
                      <ArrowUpRight className="w-4 h-4" />
                    </span>
                  </a>
                  <p className="text-sm mt-0.5 opacity-60">
                    {t("footer.coursesSubtitle")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Huge brand text — clipped at bottom */}
          <div className="relative -mb-8 select-none" aria-hidden="true">
            <p
              className="text-[clamp(8rem,20vw,22rem)] font-black leading-[0.82] tracking-tighter text-center whitespace-nowrap overflow-hidden"
              style={{
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              Yoohoo
            </p>
          </div>
        </div>

        {/* Bottom bar outside the card */}
        <div className="flex flex-col items-center justify-between px-4 py-5 text-xs text-text-secondary sm:flex-row">
          <div className="flex items-center gap-4">
            <span>Yoohoo ©{year}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
