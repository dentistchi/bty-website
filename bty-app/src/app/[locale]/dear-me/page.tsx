import { Suspense } from "react";
import DearMeClient from "./DearMeClient";
import { DearMeLoadingShell } from "./DearMeLoadingShell";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";
  const title = isKo ? "Dear Me — 나에게 쓰는 편지" : "Dear Me — Letter to yourself";
  return { title, openGraph: { title } };
}

export default async function DearMePage({ params }: Props) {
  const { locale } = await params;

  return (
    <Suspense fallback={<DearMeLoadingShell />}>
      <DearMeClient locale={locale} />
    </Suspense>
  );
}
