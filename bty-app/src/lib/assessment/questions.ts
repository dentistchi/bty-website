import type { Question } from "./types";

/**
 * Source: today-me-webapp/today-me/script.js -> questionDatabase
 * 50 questions (10 per dimension). text_en = Korean for now; replace with EN translations later.
 */
export const QUESTIONS: Question[] = [
  // core_self_esteem (1–10)
  { id: "q01", text_en: "나는 내가 다른 사람들처럼 가치 있는 사람이라고 생각한다", text_ko: "나는 내가 다른 사람들처럼 가치 있는 사람이라고 생각한다", dimension: "core_self_esteem", reverse: false },
  { id: "q02", text_en: "나는 좋은 성품을 가졌다고 생각한다", text_ko: "나는 좋은 성품을 가졌다고 생각한다", dimension: "core_self_esteem", reverse: false },
  { id: "q03", text_en: "나는 대체적으로 실패한 사람이라는 느낌이 든다", text_ko: "나는 대체적으로 실패한 사람이라는 느낌이 든다", dimension: "core_self_esteem", reverse: true },
  { id: "q04", text_en: "나는 대부분의 다른 사람들과 같이 일을 잘 할 수 있다", text_ko: "나는 대부분의 다른 사람들과 같이 일을 잘 할 수 있다", dimension: "core_self_esteem", reverse: false },
  { id: "q05", text_en: "나는 자랑할 것이 별로 없다", text_ko: "나는 자랑할 것이 별로 없다", dimension: "core_self_esteem", reverse: true },
  { id: "q06", text_en: "나는 나 자신에 대하여 긍정적인 태도를 가지고 있다", text_ko: "나는 나 자신에 대하여 긍정적인 태도를 가지고 있다", dimension: "core_self_esteem", reverse: false },
  { id: "q07", text_en: "나는 나 자신에 대하여 대체로 만족한다", text_ko: "나는 나 자신에 대하여 대체로 만족한다", dimension: "core_self_esteem", reverse: false },
  { id: "q08", text_en: "나는 나 자신을 좀 더 존중할 수 있으면 좋겠다", text_ko: "나는 나 자신을 좀 더 존중할 수 있으면 좋겠다", dimension: "core_self_esteem", reverse: true },
  { id: "q09", text_en: "나는 가끔 내 자신이 쓸모없는 사람이라는 느낌이 든다", text_ko: "나는 가끔 내 자신이 쓸모없는 사람이라는 느낌이 든다", dimension: "core_self_esteem", reverse: true },
  { id: "q10", text_en: "나는 때때로 내가 좋지 않은 사람이라고 생각한다", text_ko: "나는 때때로 내가 좋지 않은 사람이라고 생각한다", dimension: "core_self_esteem", reverse: true },
  // self_compassion (11–20)
  { id: "q11", text_en: "실수했을 때, 나는 나 자신에게 친절하게 대한다", text_ko: "실수했을 때, 나는 나 자신에게 친절하게 대한다", dimension: "self_compassion", reverse: false },
  { id: "q12", text_en: "힘들 때 나는 스스로를 따뜻하게 위로한다", text_ko: "힘들 때 나는 스스로를 따뜻하게 위로한다", dimension: "self_compassion", reverse: false },
  { id: "q13", text_en: "나의 단점을 생각하면 다른 사람들과 단절된 느낌이 든다", text_ko: "나의 단점을 생각하면 다른 사람들과 단절된 느낌이 든다", dimension: "self_compassion", reverse: true },
  { id: "q14", text_en: "고통스러운 감정이 들 때, 그것을 있는 그대로 바라본다", text_ko: "고통스러운 감정이 들 때, 그것을 있는 그대로 바라본다", dimension: "self_compassion", reverse: false },
  { id: "q15", text_en: "실패했을 때, 나는 내 자신을 가혹하게 비난한다", text_ko: "실패했을 때, 나는 내 자신을 가혹하게 비난한다", dimension: "self_compassion", reverse: true },
  { id: "q16", text_en: "모든 사람이 때로는 부족함을 느낀다는 것을 이해한다", text_ko: "모든 사람이 때로는 부족함을 느낀다는 것을 이해한다", dimension: "self_compassion", reverse: false },
  { id: "q17", text_en: "나는 나 자신의 가장 큰 응원자다", text_ko: "나는 나 자신의 가장 큰 응원자다", dimension: "self_compassion", reverse: false },
  { id: "q18", text_en: "속상할 때, 스스로에게 '괜찮아'라고 말해준다", text_ko: "속상할 때, 스스로에게 '괜찮아'라고 말해준다", dimension: "self_compassion", reverse: false },
  { id: "q19", text_en: "내 문제는 나만의 문제인 것 같아 외롭다", text_ko: "내 문제는 나만의 문제인 것 같아 외롭다", dimension: "self_compassion", reverse: true },
  { id: "q20", text_en: "어려울 때, 내가 필요한 것을 스스로에게 준다", text_ko: "어려울 때, 내가 필요한 것을 스스로에게 준다", dimension: "self_compassion", reverse: false },
  // self_esteem_stability (21–30)
  { id: "q21", text_en: "성공했을 때만 나 자신이 가치 있다고 느낀다", text_ko: "성공했을 때만 나 자신이 가치 있다고 느낀다", dimension: "self_esteem_stability", reverse: true },
  { id: "q22", text_en: "다른 사람이 나를 칭찬할 때만 기분이 좋다", text_ko: "다른 사람이 나를 칭찬할 때만 기분이 좋다", dimension: "self_esteem_stability", reverse: true },
  { id: "q23", text_en: "실패해도 나의 가치는 변하지 않는다", text_ko: "실패해도 나의 가치는 변하지 않는다", dimension: "self_esteem_stability", reverse: false },
  { id: "q24", text_en: "외모나 능력과 관계없이 나는 소중하다", text_ko: "외모나 능력과 관계없이 나는 소중하다", dimension: "self_esteem_stability", reverse: false },
  { id: "q25", text_en: "타인의 평가가 나의 자존감을 크게 흔든다", text_ko: "타인의 평가가 나의 자존감을 크게 흔든다", dimension: "self_esteem_stability", reverse: true },
  { id: "q26", text_en: "나는 무엇을 하든 존재 자체로 가치 있다", text_ko: "나는 무엇을 하든 존재 자체로 가치 있다", dimension: "self_esteem_stability", reverse: false },
  { id: "q27", text_en: "좋은 성적을 받지 못하면 나는 쓸모없다고 느낀다", text_ko: "좋은 성적을 받지 못하면 나는 쓸모없다고 느낀다", dimension: "self_esteem_stability", reverse: true },
  { id: "q28", text_en: "나의 가치는 나의 성취와 별개다", text_ko: "나의 가치는 나의 성취와 별개다", dimension: "self_esteem_stability", reverse: false },
  { id: "q29", text_en: "누군가와 비교당할 때마다 내 가치가 흔들린다", text_ko: "누군가와 비교당할 때마다 내 가치가 흔들린다", dimension: "self_esteem_stability", reverse: true },
  { id: "q30", text_en: "나는 '있는 그대로의 나'로 충분하다", text_ko: "나는 '있는 그대로의 나'로 충분하다", dimension: "self_esteem_stability", reverse: false },
  // growth_mindset (31–40)
  { id: "q31", text_en: "나의 능력은 노력으로 얼마든지 향상될 수 있다", text_ko: "나의 능력은 노력으로 얼마든지 향상될 수 있다", dimension: "growth_mindset", reverse: false },
  { id: "q32", text_en: "실패는 나에게 배움의 기회다", text_ko: "실패는 나에게 배움의 기회다", dimension: "growth_mindset", reverse: false },
  { id: "q33", text_en: "내 지능은 타고나는 것이라 바꿀 수 없다", text_ko: "내 지능은 타고나는 것이라 바꿀 수 없다", dimension: "growth_mindset", reverse: true },
  { id: "q34", text_en: "어려운 과제는 나를 더 성장시킨다", text_ko: "어려운 과제는 나를 더 성장시킨다", dimension: "growth_mindset", reverse: false },
  { id: "q35", text_en: "나는 계속해서 발전하는 사람이다", text_ko: "나는 계속해서 발전하는 사람이다", dimension: "growth_mindset", reverse: false },
  { id: "q36", text_en: "새로운 것을 배우는 과정이 즐겁다", text_ko: "새로운 것을 배우는 과정이 즐겁다", dimension: "growth_mindset", reverse: false },
  { id: "q37", text_en: "비판은 나를 더 나은 사람으로 만드는 정보다", text_ko: "비판은 나를 더 나은 사람으로 만드는 정보다", dimension: "growth_mindset", reverse: false },
  { id: "q38", text_en: "내 성격은 거의 바꿀 수 없다", text_ko: "내 성격은 거의 바꿀 수 없다", dimension: "growth_mindset", reverse: true },
  { id: "q39", text_en: "실수는 나의 성장을 증명하는 흔적이다", text_ko: "실수는 나의 성장을 증명하는 흔적이다", dimension: "growth_mindset", reverse: false },
  { id: "q40", text_en: "나는 1년 후 지금보다 더 나아질 것이다", text_ko: "나는 1년 후 지금보다 더 나아질 것이다", dimension: "growth_mindset", reverse: false },
  // social_self_esteem (41–50)
  { id: "q41", text_en: "나는 다른 사람들과 함께 있을 때 편안하다", text_ko: "나는 다른 사람들과 함께 있을 때 편안하다", dimension: "social_self_esteem", reverse: false },
  { id: "q42", text_en: "사람들이 나를 좋아하지 않을까봐 걱정된다", text_ko: "사람들이 나를 좋아하지 않을까봐 걱정된다", dimension: "social_self_esteem", reverse: true },
  { id: "q43", text_en: "나는 내 의견을 자신있게 표현한다", text_ko: "나는 내 의견을 자신있게 표현한다", dimension: "social_self_esteem", reverse: false },
  { id: "q44", text_en: "다른 사람들 앞에서 나 자신이 되기가 어렵다", text_ko: "다른 사람들 앞에서 나 자신이 되기가 어렵다", dimension: "social_self_esteem", reverse: true },
  { id: "q45", text_en: "나는 관계에서 내 가치를 인정받고 있다고 느낀다", text_ko: "나는 관계에서 내 가치를 인정받고 있다고 느낀다", dimension: "social_self_esteem", reverse: false },
  { id: "q46", text_en: "나는 다른 사람들에게 부담이 된다고 생각한다", text_ko: "나는 다른 사람들에게 부담이 된다고 생각한다", dimension: "social_self_esteem", reverse: true },
  { id: "q47", text_en: "사람들은 진짜 나를 알면 실망할 것이다", text_ko: "사람들은 진짜 나를 알면 실망할 것이다", dimension: "social_self_esteem", reverse: true },
  { id: "q48", text_en: "나는 타인과의 관계에서 당당하다", text_ko: "나는 타인과의 관계에서 당당하다", dimension: "social_self_esteem", reverse: false },
  { id: "q49", text_en: "혼자 있어도 나는 괜찮은 사람이다", text_ko: "혼자 있어도 나는 괜찮은 사람이다", dimension: "social_self_esteem", reverse: false },
  { id: "q50", text_en: "나는 사랑받을 자격이 있는 사람이다", text_ko: "나는 사랑받을 자격이 있는 사람이다", dimension: "social_self_esteem", reverse: false },
];
