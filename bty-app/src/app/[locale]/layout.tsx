import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Chatbot } from "@/components/Chatbot";
import { Comeback } from "@/components/Comeback";
import { LocaleLayoutHeader } from "@/components/LocaleLayoutHeader";
import { SkipToMainContent, MAIN_CONTENT_ID } from "@/components/SkipToMainContent";
import type { Locale } from "@/lib/i18n";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ko" }];
}

/**
 * Chatbot: locale 전역 1회 마운트 → Center `open-chatbot`·Arena·Foundry·저널 등 어디서든 패널 오픈 가능.
 * 플로팅 버튼은 Chatbot 내부에서 허브 경로에만 표시.
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "ko") {
    redirect("/en");
  }
  return (
    <>
      <SkipToMainContent locale={locale as Locale} />
      <LocaleLayoutHeader />
      <main id={MAIN_CONTENT_ID}>{children}</main>
      <Chatbot />
      <Comeback />
    </>
  );
}
