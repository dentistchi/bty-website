import { Suspense } from "react";
import PageClient from "../PageClient";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { PageLoadingFallback } from "@/components/bty-arena";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Center — 나에게 쓰는 편지",
  openGraph: { title: "Center — 나에게 쓰는 편지" },
};

/** OpenNext/Cloudflare: [locale] 동적 라우트가 빌드에 포함되도록 고정 locale 목록 제공 */
export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ko" }];
}

type Props = { params: Promise<{ locale: string }> };

export default async function CenterPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  const t = getMessages(lang as Locale).center;
  const pathname = `/${locale}/center`;

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <PageClient locale={locale} lang={lang} pathname={pathname} t={t} />
    </Suspense>
  );
}
