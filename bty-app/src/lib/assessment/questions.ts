import type { Question } from "./types";

/**
 * TODO: Replace with your real 50 questions (10 per dimension).
 * Keep reverse flags identical to your DB schema (reverse_scored).
 */
export const QUESTIONS: Question[] = [
  // EXAMPLES ONLY
  {
    id: "q01",
    text_en: "I feel that I have a number of good qualities.",
    text_ko: "나는 내 안에 좋은 자질이 꽤 있다고 느낀다.",
    dimension: "core_self_esteem",
    reverse: false,
  },
  {
    id: "q02",
    text_en: "I often feel useless.",
    text_ko: "나는 종종 내가 쓸모없다고 느낀다.",
    dimension: "core_self_esteem",
    reverse: true,
  },
];
