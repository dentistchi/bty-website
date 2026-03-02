import { Suspense } from "react";
import PageClient from "../PageClient";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { PageLoadingFallback } from "@/components/bty-arena";
import type { Metadata } from "next";

/** Cloudflare Workers/OpenNext: 동적 라우트가 런타임에 처리되도록 함 (레이아웃의 useSearchParams와 충돌하지 않음) */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Center — 나에게 쓰는 편지",
  openGraph: { title: "Center — 나에게 쓰는 편지" },
};

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
