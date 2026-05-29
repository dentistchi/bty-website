import type { Metadata } from "next";
import ResultClient from "./ui/ResultClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";
  const title = isKo ? "Center — 결과 요약" : "Center — Result summary";
  return { title, openGraph: { title } };
}

/** Dojo 50문항 결과 화면. 영역별 점수·Dr. Chi 코멘트 표시(render-only). */
export default async function AssessmentResultPage({ params }: Props) {
  const { locale } = await params;
  return <ResultClient locale={locale} />;
}
