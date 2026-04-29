"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/** `/[locale]/admin` — 랜드마크 제공 후 기본 관리 화면으로 이동. */
export default function AdminRootPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as Locale;
  const t = getMessages(locale).adminHub;

  useEffect(() => {
    router.replace(`/${locale}/admin/debug`);
  }, [router, locale]);

  return (
    <main
      aria-label={t.mainRegionAria}
      className="flex min-h-screen items-center justify-center bg-neutral-50 p-4"
    >
      <p className="text-sm text-neutral-600">{t.redirecting}</p>
    </main>
  );
}
