export type TrainDay = {
  day: number; // 1..28
  week: number; // 1..4
  title: string;
  morning: string;
  practiceTitle: string;
  practiceSteps: string[];
  why: string;
  resistance: string;
  breakthrough: string;
  evening: string;
  smallWin: string;
};

export const TRAIN_START_DATE = "2026-02-07"; // PDF 시작일

export const train28: TrainDay[] = [
  {
    day: 1,
    week: 1,
    title: "자기비판 알아차리기 시작",
    morning: "오늘 하루 동안 나는 나 자신에게 어떻게 말하는지 관찰할 것입니다.",
    practiceTitle: "자기비판 일기 (5분)",
    practiceSteps: [
      "종이와 펜을 준비합니다",
      "오늘 자신에게 했던 부정적인 말을 적습니다 (예: '또 실수했네', '멍청해')",
      "각 문장을 읽으며 느낌을 관찰합니다",
      "'친구가 이렇게 말했다면?'을 상상합니다",
    ],
    why: "자기비판을 의식하는 첫 단계. 무의식적 패턴을 의식으로 끌어올립니다.",
    resistance: "이상하게 느껴질 수 있습니다. '내가 나를 관찰한다니?'라는 생각이 듭니다.",
    breakthrough: "5분만 시도하세요. 단 한 문장만 적어도 성공입니다.",
    evening: "오늘 나는 내 생각을 관찰하는 첫 걸음을 내디뎠습니다.",
    smallWin: "자기비판을 1개 이상 알아차렸다면 → 오늘의 목표 달성!",
  },
  {
    day: 2,
    week: 1,
    title: "패턴 발견하기",
    morning: "어제 적은 자기비판 목록을 다시 읽으며 시작합니다.",
    practiceTitle: "자기비판 패턴 분석 (10분)",
    practiceSteps: [
      "어제 적은 목록을 펼칩니다",
      "반복되는 단어나 주제를 찾습니다",
      "반복되는 단어들을 동그라미로 표시합니다",
      "패턴에 이름을 붙입니다 (예: '완벽주의 비판')",
    ],
    why: "패턴을 발견하면 '이것은 나의 전부가 아니라 하나의 습관'임을 깨닫습니다.",
    resistance: "패턴이 너무 많아서 압도될 수 있습니다.",
    breakthrough: "단 1개 패턴만 찾으세요. 하나면 충분합니다.",
    evening: "나의 자기비판은 나의 본질이 아니라 학습된 패턴입니다.",
    smallWin: "반복되는 패턴을 1개 발견했다면 → 성공!",
  },
  // ... Day 3~28도 같은 구조로 추가 (지금은 Day1~2만 넣어도 UI는 동작)
];

export function clampDay(d: number) {
  return Math.max(1, Math.min(28, d));
}
