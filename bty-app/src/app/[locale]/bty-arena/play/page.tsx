import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Legacy mission play — canonical Arena is `/bty-arena`. */
export default async function BtyArenaMissionPlayRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/bty-arena`);
}
