import questions from "@/content/assessment/questions.ko.json";
import AssessmentClient from "./ui/AssessmentClient";

export const dynamic = "force-dynamic"; // 빌드/프리렌더 이슈 피하기(로그인/쿠키 무관)

export default function AssessmentPage() {
  return <AssessmentClient questions={questions as any} />;
}
