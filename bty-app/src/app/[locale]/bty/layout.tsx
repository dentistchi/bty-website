import type { ReactNode } from "react";
import { ArenaLayoutShell } from "@/components/bty/ArenaLayoutShell";
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
 * Foundry 레이아웃: /en/bty, /ko/bty 하위. Chatbot은 상위 [locale]/layout 에서 1회 마운트.
 */
export default async function BtyRootLayout({ children, params }: Props) {
  const locale = (await params)?.locale ?? "en";
  return (
    <ArenaLayoutShell locale={locale}>
      {children}
    </ArenaLayoutShell>
  );
}
