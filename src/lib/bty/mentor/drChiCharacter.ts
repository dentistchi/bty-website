/**
 * Dr. Chi 멘토 "목소리·사상" — 실제 Dr. Chi가 수정해서 사용.
 * 1) mentor_training_dataset_v1.json 있으면: 스타일 프로필 → philosophy, 대화 → few-shot (최대 8개)
 * 2) 없으면: drChiExamples.json 또는 기본 상수 사용
 * @see docs/DR_CHI_VOICE_TRAINING.md
 */

import scriptExamplesJson from "./drChiExamples.json";
import v1Dataset from "./mentor_training_dataset_v1.json";
import v1_1Dataset from "./mentor_training_dataset_v1_1.json";

type ExampleItem = { user: string; assistant: string };

/** 기본 Few-shot (v1·drChiExamples 모두 없을 때) */
const DEFAULT_FEW_SHOT: ExampleItem[] = [
  {
    user: "환자한테 설명해도 잘 안 믿는 느낌이에요.",
    assistant:
      "설명해도 안 믿는 느낌이 드시는군요. 그때 가장 마음에 걸리는 건 뭐예요? 그분 반응 때문인가요, 아니면 내가 뭘 더 해야 할지 모르겠다는 느낌인가요?",
  },
  {
    user: "팀원이랑 갈등이 있어요. 말하면 더 틀어질까 봐 조용히 있어요.",
    assistant:
      "말하면 더 틀어질까 봐 조용히 있으시는 거군요. 그 조용히 있는 게 당신에게는 어떤 감정이에요? 부담인가요, 아니면 일단 피하고 싶은 쪽인가요?",
  },
];

/** 기본 philosophy (v1 없을 때) */
const DEFAULT_PHILOSOPHY = `
**Dr. Chi의 실제 사상과 말투 (반드시 이 인격을 유지하세요):**
- 먼저 들어주고, 말한 내용을 짧게 반영한 뒤 질문한다. 조언보다 "그게 당신에게는 어떤 의미예요?" 같은 질문을 먼저 한다.
- "그냥 해보세요", "다 그런 거예요"처럼 무디게 만드는 말은 쓰지 않는다. 한 명 한 명을 진지하게 대한다.
- 기술보다 마음이 먼저라고 믿는다. 지칠 때는 기술 연습보다 자기 돌봄을 권한다.
- 치과·환자·팀·재무·자기사랑 모두 "그 사람의 맥락"을 이해하려고 한다. 일의 이야기에서도 감정과 가치가 드러나게 이끈다.
- 말은 짧고 따뜻하게. 2~4문장 안에서 반영 + 질문 하나로 마무리한다.
`.trim();

// --- v1 dataset (mentor_training_dataset_v1.json) ---
type V1StyleKo = {
  핵심특성?: string[];
  대화운영규칙?: string[];
  금지?: string[];
  대표문장패턴?: string[];
};
type V1Turn = { speaker?: string; role?: string; content_ko?: string };
type V1Conv = { id?: string; turns?: V1Turn[] };
type V1Dataset = {
  mentor_style_profile?: { ko?: V1StyleKo };
  conversations?: V1Conv[];
  few_shot_examples?: {
    mentor_chat?: Array<{ ko?: Array<{ role?: string; content?: string }> }>;
  };
};

function buildPhilosophyFromV1(ko: V1StyleKo | undefined): string {
  if (!ko) return DEFAULT_PHILOSOPHY;
  const lines: string[] = ["**Dr. Chi의 실제 사상과 말투 (반드시 이 인격을 유지하세요):**"];
  if (ko.핵심특성?.length) {
    lines.push("- 핵심: " + ko.핵심특성.join(", "));
  }
  if (ko.대화운영규칙?.length) {
    lines.push("- 대화 규칙: " + ko.대화운영규칙.join(" "));
  }
  if (ko.금지?.length) {
    lines.push("- 금지: " + ko.금지.join(", "));
  }
  if (ko.대표문장패턴?.length) {
    lines.push("- 말버릇 예: " + ko.대표문장패턴.join(" "));
  }
  return lines.join("\n").trim() || DEFAULT_PHILOSOPHY;
}

function extractPairsFromV1Conversations(conversations: V1Conv[] | undefined): ExampleItem[] {
  if (!Array.isArray(conversations)) return [];
  const pairs: ExampleItem[] = [];
  for (const conv of conversations) {
    const turns = conv.turns ?? [];
    let i = 0;
    while (i < turns.length) {
      const userTexts: string[] = [];
      while (i < turns.length && turns[i].role === "mentee") {
        const t = turns[i].content_ko ?? "";
        if (t) userTexts.push(t);
        i++;
      }
      const assistantTexts: string[] = [];
      while (i < turns.length && turns[i].role === "mentor") {
        const t = turns[i].content_ko ?? "";
        if (t) assistantTexts.push(t);
        i++;
      }
      if (userTexts.length > 0 && assistantTexts.length > 0) {
        const user = userTexts.join(" ").trim();
        const assistant = assistantTexts.join(" ").trim();
        if (user && assistant) pairs.push({ user, assistant });
      }
    }
  }
  return pairs.slice(0, 8);
}

function getV1FewShotExamples(v1: V1Dataset): ExampleItem[] {
  const fromConv = extractPairsFromV1Conversations(v1.conversations);
  if (fromConv.length > 0) return fromConv;
  const mentorChat = v1.few_shot_examples?.mentor_chat;
  if (!Array.isArray(mentorChat)) return [];
  const out: ExampleItem[] = [];
  for (const block of mentorChat) {
    const ko = block.ko;
    if (!Array.isArray(ko) || ko.length < 2) continue;
    let user = "";
    let assistant = "";
    for (const m of ko) {
      if (m.role === "user" && typeof m.content === "string") user = m.content;
      if (m.role === "assistant" && typeof m.content === "string") assistant = m.content;
    }
    if (user && assistant) out.push({ user, assistant });
  }
  return out.slice(0, 8);
}

const v1Raw = (v1_1Dataset ?? v1Dataset) as V1Dataset;
const v1 = v1Raw;
const philosophyFromV1 =
  v1?.mentor_style_profile?.ko != null
    ? buildPhilosophyFromV1(v1.mentor_style_profile.ko)
    : null;
const fewShotFromV1 = getV1FewShotExamples(v1);

/** Dr. Chi philosophy: v1 스타일 프로필이 있으면 그걸로, 없으면 기본 */
export const DR_CHI_PHILOSOPHY = philosophyFromV1 ?? DEFAULT_PHILOSOPHY;

/** Few-shot: v1 대화 추출 → drChiExamples.json → 기본 순 */
const fromScript = (() => {
  const raw = scriptExamplesJson as unknown;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .filter((x) => typeof x.user === "string" && typeof x.assistant === "string")
    .map((x) => ({ user: String(x.user), assistant: String(x.assistant) }));
})();

export const DR_CHI_FEW_SHOT_EXAMPLES: ExampleItem[] =
  fewShotFromV1.length > 0
    ? fewShotFromV1
    : fromScript.length > 0
      ? fromScript.slice(0, 8)
      : DEFAULT_FEW_SHOT;
