import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Guidance → 기존 Mentor 라우트 */
export default async function GrowthGuidanceRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/bty/mentor`);
}
