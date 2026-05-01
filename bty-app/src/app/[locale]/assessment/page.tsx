import questionsKo from "@/content/assessment/questions.ko.json";
import questionsEn from "@/content/assessment/questions.en.json";
import AssessmentClient from "./ui/AssessmentClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

/** §7: 50문항 한 문항씩 스텝 플로우. locale별 질문: ko → questions.ko.json, en → questions.en.json */
export default async function AssessmentPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  const questions = lang === "ko" ? questionsKo : questionsEn;
  return <AssessmentClient questions={questions as Parameters<typeof AssessmentClient>[0]["questions"]} locale={lang} />;
}
