import { Suspense } from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import ClientPage from "./page.client";
import { PageLoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  const t = getMessages(lang as Locale).bty;
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <ClientPage locale={locale} t={t} />
    </Suspense>
  );
}
