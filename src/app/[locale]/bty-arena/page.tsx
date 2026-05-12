import ArenaEntryClient from "./ArenaEntryClient";

/** Arena landing: mode select (Full Arena 7-step / Quick Decision). */
type Props = { params: Promise<{ locale: string }> };

export default async function BtyArenaPage({ params }: Props) {
  const { locale } = await params;
  return <ArenaEntryClient locale={locale} />;
}
