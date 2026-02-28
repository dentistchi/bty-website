import { Suspense } from "react";
import PageClient from "../PageClient";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { PageLoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function DearMePage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  const t = getMessages(lang as Locale).todayMe;
  const pathname = `/${locale}/dear-me`;

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <PageClient locale={locale} lang={lang} pathname={pathname} t={t} />
    </Suspense>
  );
}
