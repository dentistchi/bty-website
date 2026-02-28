import { Suspense } from "react";
import LandingClient from "./LandingClient";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { PageLoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  const t = getMessages(lang as Locale).landing;
  const pathname = `/${locale}`;

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <LandingClient locale={locale} pathname={pathname} t={t} />
    </Suspense>
  );
}
