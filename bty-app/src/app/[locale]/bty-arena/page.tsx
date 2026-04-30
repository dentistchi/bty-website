import ArenaEntryClient from "./ArenaEntryClient";

type Props = { params: Promise<{ locale: string }> };

/**
 * Canonical Arena route — shows mode selector (Full Arena / Quick Decision).
 * Full Arena renders BtyArenaRunPageClient inline; Quick Decision links to /bty-arena/quick.
 */
export default async function BtyArenaPage({ params }: Props) {
  const { locale } = await params;
  return <ArenaEntryClient locale={locale} />;
}
