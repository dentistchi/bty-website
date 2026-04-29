import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Legacy resolve chamber — canonical Arena is `/bty-arena`. */
export default async function ArenaPlayResolveRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/bty-arena`);
}
