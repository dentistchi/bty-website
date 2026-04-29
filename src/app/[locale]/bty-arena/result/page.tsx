import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Legacy mission result — canonical Arena is `/bty-arena`. */
export default async function BtyArenaMissionResultRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/bty-arena`);
}
