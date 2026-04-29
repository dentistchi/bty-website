import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Alias: same session UI as `/bty-arena`. */
export default async function ArenaLobbyAliasRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/bty-arena`);
}
