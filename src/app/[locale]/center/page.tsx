import { Suspense } from "react";
import CenterPageClient from "./CenterPageClient";
import { CenterLoadingShell } from "./CenterLoadingShell";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";
  const title = isKo ? "Center — 나의 쉼터" : "Center — Your reset space";
  return { title, openGraph: { title } };
}

export default async function CenterPage({ params }: Props) {
  const { locale } = await params;

  return (
    <Suspense fallback={<CenterLoadingShell />}>
      <CenterPageClient locale={locale} />
    </Suspense>
  );
}
