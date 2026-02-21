import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export const dynamic = "force-dynamic";

/** Locale-prefixed entrypoint: /en/assessment/result, /ko/assessment/result → /assessment/result */
export default async function LocaleAssessmentResultPage({ params }: Props) {
  await params;
  redirect("/assessment/result");
}
