import { Suspense } from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import FoundryHubClient from "./page.client";
import { PageLoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function FoundryHubPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  const t = getMessages(lang as Locale).bty;
  const tLand = getMessages(lang as Locale).landing;
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <FoundryHubClient locale={locale} t={t} tLand={tLand} />
    </Suspense>
  );
}
