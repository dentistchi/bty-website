import type { ReactNode } from "react";
import { CenterLayoutShell } from "@/components/bty/CenterLayoutShell";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export default async function CenterLayout({ children, params }: Props) {
  const { locale } = await params;
  return <CenterLayoutShell locale={locale}>{children}</CenterLayoutShell>;
}
