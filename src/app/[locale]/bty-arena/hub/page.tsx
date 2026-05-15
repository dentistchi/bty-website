import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Alias: Hub content migration backlog — redirects to `/bty-arena` (Stage 2 step 6 2E). */
export default async function ArenaHubAliasRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/bty-arena`);
}
