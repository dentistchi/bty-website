import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LocaleLayoutHeader } from "@/components/LocaleLayoutHeader";

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
    </>
  );
}
