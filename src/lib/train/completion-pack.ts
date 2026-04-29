import type { CompletionPack } from "@/types/train";

type Lesson = {
  day: number;
  title?: string;
  sections?: Record<string, string>;
};

function firstLine(s?: string) {
  if (!s) return "";
  return s.split("\n").map(x => x.trim()).find(Boolean) ?? "";
}

function pickKey(sections: Record<string, string> | undefined, candidates: string[]) {
  if (!sections) return "";
  for (const k of candidates) {
    if (sections[k]) return sections[k];
  }
  // fallback: 아무 섹션이나 첫 번째
  const any = Object.values(sections)[0];
  return any ?? "";
}

/**
 * ✅ 지금은 "규칙 기반" 더미 생성
 * ✅ 나중엔 서버에서 LLM 결과를 받아 그대로 pack으로 넣으면 됨
 */
export function buildCompletionPackFromLesson(lesson: Lesson): CompletionPack {
  const sections = lesson.sections ?? {};

  const morning = firstLine(pickKey(sections, ["Morning ritual", "아침 의식", "Morning"]));
  const practice = pickKey(sections, ["Core practice", "핵심 실천", "Practice"]);
  const why = firstLine(pickKey(sections, ["Why it works", "왜 효과가 있을까?", "Why"]));
  const breakthrough = firstLine(pickKey(sections, ["Breakthrough strategy", "돌파 전략", "Strategy"]));

  // practice에서 "핵심 행동"을 첫 줄로 잡고, 너무 길면 줄임
  const practiceHeadline = firstLine(practice).slice(0, 140);

  // 질문 3개: (1) 관찰 (2) 재구성 (3) 내일 미세 행동
  const questions = [
    `What did you notice about your self-talk today? Name one exact phrase you caught.`,
    `If a close friend said that phrase, what would you reply in one kind sentence?`,
    `What is one 60-second micro-step you can repeat tomorrow to make this easier?`,
  ];

  const summary: string[] = [];
  if (morning) summary.push(`Morning intention: ${morning}`);
  if (practiceHeadline) summary.push(`Core action: ${practiceHeadline}`);
  if (why) summary.push(`Why it matters: ${why}`);
  if (breakthrough) summary.push(`If it felt awkward, remember: ${breakthrough}`);

  // 너무 적으면 타이틀을 추가
  if (summary.length < 2) {
    summary.unshift(`You completed Day ${lesson.day}: ${lesson.title ?? "Training"}.`);
  }

  return {
    day: lesson.day,
    generatedAtISO: new Date().toISOString(),
    summary,
    questions,
    nextMicroStep: `Tomorrow: do a 10-minute version (or even 1 sentence).`,
  };
}
