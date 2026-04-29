import { Suspense } from "react";
import PageClient from "../PageClient";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { CenterLoadingShell } from "./CenterLoadingShell";
import type { Metadata } from "next";

/** Cloudflare Workers/OpenNext: 동적 라우트가 런타임에 처리되도록 함 (레이아웃의 useSearchParams와 충돌하지 않음) */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

/** §8: locale에 맞는 메타데이터 (영어 버전은 영어로) */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";
  const title = isKo ? "Center — 나에게 쓰는 편지" : "Center — Letter to yourself";
  return { title, openGraph: { title } };
}

export default async function CenterPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  const t = getMessages(lang as Locale).center;
  const pathname = `/${locale}/center`;

  return (
    <Suspense fallback={<CenterLoadingShell />}>
      <PageClient locale={locale} lang={lang} pathname={pathname} t={t} />
    </Suspense>
  );
}
