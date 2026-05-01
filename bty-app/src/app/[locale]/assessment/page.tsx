import questionsKo from "@/content/assessment/questions.ko.json";
import AssessmentClient from "./ui/AssessmentClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

/** §7: 50문항 한 문항씩 스텝 플로우. locale별 질문: ko → questions.ko.json, en → 동일 구조 사용(추후 questions.en.json 추가 시 교체). */
export default async function AssessmentPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  return <AssessmentClient questions={questionsKo as Parameters<typeof AssessmentClient>[0]["questions"]} locale={lang} />;
}
