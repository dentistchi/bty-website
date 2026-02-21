import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export const dynamic = "force-dynamic";

/** Locale-prefixed entrypoint: /en/assessment, /ko/assessment → /assessment */
export default async function LocaleAssessmentPage({ params }: Props) {
  await params;
  redirect("/assessment");
}
