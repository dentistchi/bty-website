import HistoryClient from "./HistoryClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function FoundryHistoryPage({ params }: Props) {
  const { locale } = await params;
  return <HistoryClient locale={locale} />;
}
