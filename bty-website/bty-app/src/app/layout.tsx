import "./globals.css";
import type { Metadata } from "next";
import { Noto_Serif_KR } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { Chatbot } from "@/components/Chatbot";
import { SetLocale } from "@/components/SetLocale";

const notoSerifKr = Noto_Serif_KR({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-kr",
});

export const metadata: Metadata = {
  title: "Dear Me — 나에게 쓰는 편지",
  description: "자존감 회복실. 평가와 조언 없이, 심리적 안전과 자기 수용을 위한 공간.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`font-sans antialiased min-h-screen ${notoSerifKr.variable}`}>
        <SessionProvider>
          <AuthProvider>
            <SetLocale />
            {children}
            <Chatbot />
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
