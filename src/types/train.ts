export type CompletionPack = {
  day: number;
  generatedAtISO: string;
  summary: string[];     // "오늘 내가 한 것" 요약 bullets
  questions: string[];   // 강화 질문 3개
  nextMicroStep?: string; // 내일/지금 바로 할 1줄 액션(선택)
};
