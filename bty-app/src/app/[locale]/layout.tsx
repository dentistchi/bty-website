import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LocaleLayoutHeader } from "@/components/LocaleLayoutHeader";
import { Chatbot } from "@/components/Chatbot";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ko" }];
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "ko") {
    redirect("/en");
  }
  return (
    <>
      <LocaleLayoutHeader />
      {children}
      {/* §6 CENTER_PAGE_IMPROVEMENT_SPEC: "챗으로 이어하기" 클릭 시 open-chatbot 이벤트로 챗 패널 열기 */}
      <Chatbot />
    </>
  );
}
