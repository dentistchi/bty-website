import type { Metadata } from "next";
import { headers } from "next/headers";
import { Noto_Serif_KR } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { SetLocale } from "@/components/SetLocale";
import "./globals.css";

const notoSerifKr = Noto_Serif_KR({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-kr",
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
