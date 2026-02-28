import type { ReactNode } from "react";
import { ArenaLayoutShell } from "@/components/bty/ArenaLayoutShell";

export const dynamic = "force-dynamic";

/**
 * Arena 레이아웃: /en/bty-arena, /ko/bty-arena (및 beginner 등) 에 동일 스티키 헤더·테마 적용.
 */
export default function BtyArenaLayout({ children }: { children: ReactNode }) {
  return <ArenaLayoutShell>{children}</ArenaLayoutShell>;
}
