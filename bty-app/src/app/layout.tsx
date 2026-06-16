import type { Metadata } from "next";
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
