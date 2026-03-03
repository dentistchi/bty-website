import questions from "@/content/assessment/questions.ko.json";
import AssessmentClient from "./ui/AssessmentClient";

export const dynamic = "force-dynamic"; // 빌드/프리렌더 이슈 피하기(로그인/쿠키 무관)

type Props = { params: Promise<{ locale: string }> };

export default async function AssessmentPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  return <AssessmentClient questions={questions as any} locale={lang} />;
}
