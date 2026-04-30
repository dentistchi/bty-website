"use client";

import { usePathname } from "next/navigation";
import { TabPills } from "@/components/bty/ui/TabPills";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { locale: string };

export function BtyMyPageTabs({ locale }: Props) {
  const pathname = usePathname();
  const base = `/${locale}/my-page`;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).myPageStub;

  const items = [
    {
      label: t.myPageTabOverview,
      href: base,
      active: pathname === base || pathname === `${base}/`,
    },
    {
      label: t.myPageTabProgress,
      href: `${base}/progress`,
      active: pathname === `${base}/progress`,
    },
    {
      label: t.myPageTabTeam,
      href: `${base}/team`,
      active: pathname === `${base}/team`,
    },
    {
      label: t.myPageTabLeader,
      href: `${base}/leader`,
      active: pathname === `${base}/leader`,
    },
    {
      label: t.myPageTabAccount,
      href: `${base}/account`,
      active: pathname === `${base}/account`,
    },
  ];

  return <TabPills items={items} aria-label={t.myPageTabsAria} />;
}
