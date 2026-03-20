import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Prototype lobby path → unified mission runtime at `/bty-arena`. */
export default async function ArenaLobbyPage({ params }: Props) {
  const { locale } = await params;
  const loc = locale === "ko" ? "ko" : "en";
  redirect(`/${loc}/bty-arena`);
}
