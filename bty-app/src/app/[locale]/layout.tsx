import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LocaleLayoutHeader } from "@/components/LocaleLayoutHeader";
import { SkipToMainContent, MAIN_CONTENT_ID } from "@/components/SkipToMainContent";
import type { Locale } from "@/lib/i18n";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ko" }];
}

/**
 * 전역 플로팅 Chatbot 비노출. 챗은 Center·Foundry(bty) 등 필요한 경로 레이아웃/페이지에서만 마운트.
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
    </>
  );
}
