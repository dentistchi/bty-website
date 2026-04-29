import { Suspense } from "react";
import DojoMicroClient from "./DojoMicroClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function FoundryDojoMicroPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  return (
    <Suspense fallback={<main className="max-w-xl mx-auto px-4 py-8">…</main>}>
      <DojoMicroClient locale={lang} routeLocale={locale} />
    </Suspense>
  );
}
