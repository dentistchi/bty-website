import type { ReactNode } from "react";
import { CenterLayoutShell } from "@/components/bty/CenterLayoutShell";

export default function CenterLayout({ children }: { children: ReactNode }) {
  return <CenterLayoutShell>{children}</CenterLayoutShell>;
}
