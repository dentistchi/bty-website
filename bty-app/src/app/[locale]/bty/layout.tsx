import type { ReactNode } from "react";

export default function BtyRootLayout({ children }: { children: ReactNode }) {
  // ✅ 여기에는 절대 auth redirect/guard 넣지 말 것
  // login까지 같이 감싸면 /bty/login이 무한 리다이렉트 됨
  return <>{children}</>;
}
