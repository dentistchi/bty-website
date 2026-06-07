import { Suspense } from "react";
import type { Metadata } from "next";
import LettersClient from "./LettersClient";
import { CenterLoadingShell } from "../CenterLoadingShell";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "ko" ? "편지 캘린더" : "Letter calendar";
  return { title, openGraph: { title } };
}

export default async function CenterLettersPage({ params }: Props) {
  const { locale } = await params;
  return (
    <Suspense fallback={<CenterLoadingShell />}>
      <LettersClient locale={locale} />
    </Suspense>
  );
}
