import BtyArenaRunPageClient from "../BtyArenaRunPageClient";

type Props = { params: Promise<{ locale: string }> };

/** Arena Play surface — in-scenario triad (PRIMARY_CHOICE → TRADEOFF → ACTION_DECISION) per v1.1 §5.2. Entered from Lobby (/bty-arena) via Full Arena navigation. */
export default async function ArenaPlayPage({ params }: Props) {
  await params;
  return <BtyArenaRunPageClient pipelineDefault="new" />;
}
