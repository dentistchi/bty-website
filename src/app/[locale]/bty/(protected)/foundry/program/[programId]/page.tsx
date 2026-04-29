import ProgramDetailClient from "./page.client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; programId: string }> };

export default async function FoundryProgramDetailPage({ params }: Props) {
  const { locale, programId } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  return <ProgramDetailClient locale={lang} programId={decodeURIComponent(programId)} />;
}
