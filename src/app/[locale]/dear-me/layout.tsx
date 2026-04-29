import type { ReactNode } from "react";
import { CenterLayoutShell } from "@/components/bty/CenterLayoutShell";

export default function DearMeLayout({ children }: { children: ReactNode }) {
  return <CenterLayoutShell>{children}</CenterLayoutShell>;
}
