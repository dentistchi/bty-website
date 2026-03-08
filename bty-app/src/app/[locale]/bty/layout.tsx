import type { ReactNode } from "react";
import { ArenaLayoutShell } from "@/components/bty/ArenaLayoutShell";
import { Chatbot } from "@/components/Chatbot";
import type { Metadata } from "next";

type Props = { children: ReactNode; params?: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params)?.locale ?? "en";
  const isKo = locale === "ko";
  return {
    title: isKo ? "bty | BTY Arena" : "bty | BTY Arena",
    openGraph: { title: isKo ? "bty | BTY Arena" : "bty | BTY Arena" },
  };
}

/**
 * Foundry 레이아웃: /en/bty, /ko/bty 하위 모든 경로(dashboard, mentor 등)에 적용.
 * 챗이 필요한 경로에만 Chatbot 마운트(전역 비노출).
 */
export default async function BtyRootLayout({ children, params }: Props) {
  return (
    <ArenaLayoutShell>
      {children}
      <Chatbot />
    </ArenaLayoutShell>
  );
}
