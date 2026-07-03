import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { AuthProvider } from "@/contexts/AuthContext";
import { SetLocale } from "@/components/SetLocale";
import "./globals.css";

// FONT_VENDOR_A: self-hosted latin-subset Noto Serif KR (was the Google font loader).
// Removes Cloudflare/OpenNext build-time fetch to fonts.gstatic.com (ETIMEDOUT risk).
const notoSerifKr = localFont({
  src: [
    { path: "./fonts/noto-serif-kr-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/noto-serif-kr-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/noto-serif-kr-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-serif-kr",
  fallback: ["Georgia", "Batang", "serif"],
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "btyARENA — Better Than Yesterday",
  description: "A leadership training arena where everyday decisions become better than yesterday.",
};

/**
 * Native/mobile app shell: `viewportFit: "cover"` lets the WebView draw under the iOS status
 * bar / home indicator and — critically — makes `env(safe-area-inset-*)` resolve to non-zero.
 * Without it those insets are 0, so the ArenaLayoutShell status-bar spacer and the BottomNav
 * bottom padding would be inert. width/initial-scale keep Next.js's default responsive viewport
 * (so Tailwind `md:` breakpoints behave as mobile in the app). Desktop is unaffected.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = (await headers()).get("x-locale") ?? "ko";
  return (
    <html lang={locale}>
      <body className={`font-sans antialiased min-h-screen ${notoSerifKr.variable}`}>
        <AuthProvider>
          <SetLocale />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
