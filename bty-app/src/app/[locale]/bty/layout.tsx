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
 * Arena 레이아웃: /en/bty, /ko/bty 하위 모든 경로에 적용.
 */
export default async function BtyRootLayout({ children, params }: Props) {
  return <ArenaLayoutShell>{children}</ArenaLayoutShell>;
}
