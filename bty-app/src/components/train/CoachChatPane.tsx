"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getTrainDay } from "@/lib/trainContent";

type Progress = {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAt: string | null;
};

function buildSummaryAndQuestions(day: number) {
  const d = getTrainDay(day);
  if (!d) return null;

  const core = d.sections["핵심 실천"] ?? "";
  const resist = d.sections["예상되는 저항"] ?? "";
  const breakthru = d.sections["돌파 전략"] ?? "";

  const summary =
    `오늘(Day ${day})의 핵심은 이거야:\n` +
    `- 핵심 실천: ${core.slice(0, 180)}${core.length > 180 ? "..." : ""}\n` +
    `- 예상 저항: ${resist.slice(0, 120)}${resist.length > 120 ? "..." : ""}\n` +
    `- 돌파 전략: ${breakthru.slice(0, 120)}${breakthru.length > 120 ? "..." : ""}\n`;

  const questions = [
    `오늘 가장 어려웠던 순간은 언제였고, 그때 몸/마음 신호는 뭐였어?`,
    `내일 같은 상황이 오면, "돌파 전략" 중 하나를 10초 안에 실행한다면 뭘 고를래?`,
    `오늘 실천이 "어제의 나" 대비 조금이라도 나아진 지점이 있다면 한 문장으로 말해줘.`,
  ];

  return { summary, questions };
}

export default function CoachChatPane({
  progress,
  showCompletionSummary = false,
  onViewedCompletionSummary,
}: {
  progress: Progress;
  showCompletionSummary?: boolean;
  onViewedCompletionSummary?: () => void;
}) {
  const pathname = usePathname();
  const day = useMemo(() => {
    const m = pathname.match(/\/train\/day\/(\d+)/);
    return m ? Number(m[1]) : 1;
  }, [pathname]);

  const [tab, setTab] = useState<"chat" | "complete">("chat");

  // 완료 성공 시 오른쪽 탭을 "완료 요약"으로 전환
  useEffect(() => {
    if (showCompletionSummary) {
      setTab("complete");
      onViewedCompletionSummary?.();
    }
  }, [showCompletionSummary, onViewedCompletionSummary]);

  const completion = useMemo(() => {
    // "현재 day가 완료된 상태"라면 요약 탭을 의미있게 보여줌
    if (progress.lastCompletedDay >= day) return buildSummaryAndQuestions(day);
    return null;
  }, [progress.lastCompletedDay, day]);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button
          className={`px-3 py-1 rounded-full text-sm border ${tab === "chat" ? "bg-black text-white" : "bg-white"}`}
          onClick={() => setTab("chat")}
        >
          코치 챗
        </button>
        <button
          className={`px-3 py-1 rounded-full text-sm border ${tab === "complete" ? "bg-black text-white" : "bg-white"}`}
          onClick={() => setTab("complete")}
        >
          완료 요약
        </button>
      </div>

      {tab === "chat" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">코치 챗</div>
          <div className="text-xs text-gray-500">(여기서 나중에 레슨 컨텍스트 주입 + 대화 저장)</div>

          <div className="mt-4 rounded-xl border p-3 text-sm text-gray-600">
            프롬프트(예시)
            <div className="mt-2 whitespace-pre-wrap text-gray-700">
              오늘은 Day {day}야.  
              내가 지금 느끼는 감정/저항을 한 문장으로 말할게: "___".  
              코치는 "핵심 실천"을 10분 버전으로 줄여서 제안하고, 한 번만 더 하게 만드는 말을 해줘.
            </div>
          </div>
        </div>
      )}

      {tab === "complete" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">오늘 완료 요약/강화 질문</div>

          {!completion && (
            <div className="text-sm text-gray-600">
              아직 Day {day}가 완료되지 않았어. 좌측에서 "오늘 실천 완료"를 누르면 생성돼.
            </div>
          )}

          {completion && (
            <>
              <div className="rounded-xl border p-3 text-sm whitespace-pre-wrap">
                {completion.summary}
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">강화 질문 3개</div>
                <ol className="mt-2 list-decimal pl-5 text-sm text-gray-700 space-y-2">
                  {completion.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
