import type { ReactNode } from "react";
import { ArenaLayoutShell } from "@/components/bty/ArenaLayoutShell";

export const dynamic = "force-dynamic";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/**
 * Arena 레이아웃: /en/bty-arena, /ko/bty-arena (및 beginner 등) 에 동일 스티키 헤더·테마 적용.
 */
export default async function BtyArenaLayout({ children, params }: Props) {
  const { locale } = await params;
  return <ArenaLayoutShell locale={locale}>{children}</ArenaLayoutShell>;
}
