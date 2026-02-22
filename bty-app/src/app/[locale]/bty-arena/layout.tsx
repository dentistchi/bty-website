import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function BtyArenaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
