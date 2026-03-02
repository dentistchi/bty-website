import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

/** Legacy path: redirect /dear-me to /center */
export default async function DearMeRedirectPage({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/center`);
}
