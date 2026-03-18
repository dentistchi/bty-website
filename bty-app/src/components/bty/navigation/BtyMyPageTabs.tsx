"use client";

import { usePathname } from "next/navigation";
import { TabPills } from "@/components/bty/ui/TabPills";

type Props = { locale: string };

export function BtyMyPageTabs({ locale }: Props) {
  const pathname = usePathname();
  const base = `/${locale}/my-page`;

  const items = [
    {
      label: "Overview",
      href: base,
      active: pathname === base || pathname === `${base}/`,
    },
    {
      label: "Progress",
      href: `${base}/progress`,
      active: pathname === `${base}/progress`,
    },
    {
      label: "Team",
      href: `${base}/team`,
      active: pathname === `${base}/team`,
    },
    {
      label: "Leader",
      href: `${base}/leader`,
      active: pathname === `${base}/leader`,
    },
    { label: "Account", disabled: true },
  ];

  return <TabPills items={items} aria-label="My Page sections" />;
}
