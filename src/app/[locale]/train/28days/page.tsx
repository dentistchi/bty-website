"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export default function Track28Home() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" && params.locale === "ko") ? "ko" : "en";
  const t = getMessages(locale as Locale).train;

  return (
    <main className="space-y-4" aria-label={t.track28HubMainRegionAria}>
      <h1 className="text-2xl font-semibold">28일 훈련</h1>
      <p className="opacity-70">
        왼쪽에서 Day를 선택하면 레슨이 가운데에 뜨고, 오른쪽에서 코치 챗으로 질문/동기부여를 받을 수 있어.
      </p>
      <div className="rounded-lg border p-4">
        <Link className="underline" href={`/${locale}/train/28days/day/1`} aria-label={locale === "ko" ? "Day 1 시작하기" : "Start Day 1"}>
          Day 1 시작하기
        </Link>
      </div>
    </main>
  );
}
