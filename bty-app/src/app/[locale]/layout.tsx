import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LangSwitch } from "@/components/LangSwitch";

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
      <div className="fixed top-2 right-2 z-[9998]">
        <LangSwitch />
      </div>
      {children}
    </>
  );
}
