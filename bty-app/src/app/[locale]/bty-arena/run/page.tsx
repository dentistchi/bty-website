import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Compatibility: canonical Arena play is `/[locale]/bty-arena`. */
export default async function BtyArenaRunAliasRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/bty-arena`);
}
