import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Growth 경로 정합 — 실제 Dojo는 Foundry/BTY 하위 유지 */
export default async function GrowthDojoRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/bty/dojo`);
}
