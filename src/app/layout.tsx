import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import QueryProvider from "@/lib/query-provider";
import { SessionProvider } from "@/lib/session-provider";
import { AppToaster } from "@/lib/toast";
import "katex/dist/katex.min.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { SessionData } from "@/lib/session-provider";
import ThemeProvider from "@/components/theme/ThemeProvider";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-plus-jakarta-sans" });

export const metadata: Metadata = {
  title: "Yoohoo — AI Flashcard & Quiz Generator",
  description: "Turn course PDFs and books into interactive AI-generated flashcards and quizzes.",
  icons: {
    icon: "/logo_yoohoo.png",
    shortcut: "/logo_yoohoo.png",
    apple: "/logo_yoohoo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialSession = await auth.api.getSession({ headers: await headers() });

  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-bg text-text font-sans flex flex-col">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          enableColorScheme
          disableTransitionOnChange
          storageKey="yoohoo-theme"
        >
          <ErrorBoundary>
            <QueryProvider>
              <SessionProvider initialSession={initialSession as SessionData | null}>
                <LanguageProvider>
                  {children}
                  <AppToaster />
                </LanguageProvider>
              </SessionProvider>
            </QueryProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
