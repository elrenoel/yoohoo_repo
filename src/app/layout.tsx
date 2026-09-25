import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import QueryProvider from "@/lib/query-provider";
import { SessionProvider } from "@/lib/session-provider";
import Footer from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yoohoo — AI Flashcard & Quiz Generator",
  description: "Ubah materi PDF kuliah & buku jadi flashcard dan quiz interaktif otomatis dengan AI.",
  icons: {
    icon: "/logo_yoohoo.png",
    shortcut: "/logo_yoohoo.png",
    apple: "/logo_yoohoo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-neutral-50 text-neutral-900 font-sans flex flex-col selection:bg-neutral-900 selection:text-white">
        <ErrorBoundary>
          <QueryProvider>
            <SessionProvider>
              <LanguageProvider>
                {children}
                <Footer />
              </LanguageProvider>
            </SessionProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
