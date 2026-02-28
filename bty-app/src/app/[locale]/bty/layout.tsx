import type { ReactNode } from "react";
import { ArenaLayoutShell } from "@/components/bty/ArenaLayoutShell";

/**
 * Arena 레이아웃: /en/bty, /ko/bty 하위 모든 경로에 적용.
 * auth redirect/guard는 여기 넣지 말 것 — /bty/login 무한 리다이렉트 방지.
 */
export default function BtyRootLayout({ children }: { children: ReactNode }) {
  return <ArenaLayoutShell>{children}</ArenaLayoutShell>;
}
