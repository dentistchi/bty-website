import type { ReactNode } from "react";

export default function BtyProtectedLayout({ children }: { children: ReactNode }) {
  // ✅ 필요하면 여기에서만 (클라이언트 가드/서버 가드) 추가 가능
  // login은 (public)이라 여기에 영향 없음
  return <>{children}</>;
}
