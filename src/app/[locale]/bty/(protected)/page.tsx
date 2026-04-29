import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import ClientPage from "./page.client";
import { PageLoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

/**
 * `ENGINE_ARCHITECTURE_V1.md` §6.3 — `arena_contract=resolve` is owned by My Page resolution surface.
 * Middleware lands users on `/{locale}/bty?arena_contract=resolve`; we forward to my-page with the same query.
 */
export default async function Page({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([
    params,
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);

  if (firstSearchParam(sp?.arena_contract) === "resolve") {
    redirect(`/${locale}/my-page?arena_contract=resolve`);
  }

  const lang = locale === "ko" ? "ko" : "en";
  const t = getMessages(lang as Locale).bty;
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <ClientPage locale={locale} t={t} />
    </Suspense>
  );
}
