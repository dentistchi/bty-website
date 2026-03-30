import { permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/**
 * Legacy path — canonical Arena is `/[locale]/bty-arena` (`middleware.ts` also 308s here).
 */
export default async function ArenaPage({ params }: Props) {
  const { locale } = await params;
  const loc = locale === "ko" ? "ko" : "en";
  permanentRedirect(`/${loc}/bty-arena`);
}
