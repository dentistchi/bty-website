import QuickModePageClient from "./page.client";

type Props = { params: Promise<{ locale: string }> };

export default async function QuickModePage({ params }: Props) {
  const { locale } = await params;
  return <QuickModePageClient locale={locale} />;
}
