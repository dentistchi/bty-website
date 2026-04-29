import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";
  return {
    title: isKo ? "로그인 · BTY Arena" : "Sign in · BTY Arena",
    description: isKo
      ? "BTY Arena 계정으로 로그인합니다."
      : "Sign in to your BTY Arena account.",
  };
}

export default async function Page({ searchParams, params }: Props) {
  const [{ locale: localeParam }, sp] = await Promise.all([
    params,
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);
  const locale: "en" | "ko" = localeParam === "ko" ? "ko" : "en";

  const nextParam = sp.next;
  const next =
    typeof nextParam === "string"
      ? nextParam
      : Array.isArray(nextParam)
        ? nextParam[0]
        : "";

  const errParam = sp.error;
  const oauthError =
    typeof errParam === "string" ? errParam : Array.isArray(errParam) ? errParam[0] : undefined;

  return <LoginClient nextPath={next ?? ""} locale={locale} oauthError={oauthError} />;
}
