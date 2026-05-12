import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/**
 * Legacy/mistyped URL: `/[locale]/result`
 * The Center 50-item assessment lives under `/[locale]/assessment/result`.
 */
export default async function LegacyLocaleResultRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/assessment/result`);
}
