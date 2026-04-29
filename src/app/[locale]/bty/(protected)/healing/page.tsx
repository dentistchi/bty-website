import { Suspense } from "react";
import HealingPageClient from "./page.client";
import { PageLoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function HealingPage({ params }: Props) {
  const { locale } = await params;
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <HealingPageClient locale={locale} />
    </Suspense>
  );
}
