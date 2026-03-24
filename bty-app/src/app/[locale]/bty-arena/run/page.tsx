import { permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export const dynamic = "force-dynamic";

/** Compatibility: canonical Arena play is `/[locale]/bty-arena` (middleware also 308s here). */
export default async function BtyArenaRunAliasRedirect({ params }: Props) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/bty-arena`);
}
