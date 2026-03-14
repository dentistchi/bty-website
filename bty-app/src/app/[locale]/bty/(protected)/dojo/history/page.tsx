import DojoHistoryClient from "./DojoHistoryClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function DojoHistoryPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  return <DojoHistoryClient locale={lang} />;
}
