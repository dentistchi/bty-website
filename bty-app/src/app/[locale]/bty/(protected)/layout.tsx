import type { ReactNode } from "react";

/**
 * (protected) 구간: 상위 bty/layout.tsx 에서 이미 Arena 레이아웃 적용.
 * 여기서는 자식만 그대로 전달.
 */
export default function BtyProtectedLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
