/**
 * Phase-matched Dr. Chi RAG expansion — one extra coaching micro-block per request (Foundry).
 */

import type { MentorContext } from "@/engine/rag/mentor-context.service";
import type { HealingPhase } from "@/engine/healing/healing-phase.service";

type Bilingual = { ko: string; en: string };

export type RagExpansionBlock = {
  phase: HealingPhase;
  topic: Bilingual;
  exampleSituation: Bilingual;
  coachingResponse: Bilingual;
};

/** Three bilingual blocks per healing phase (12 total). */
export const RAG_EXPANSION_BANK: Record<
  HealingPhase,
  readonly [RagExpansionBlock, RagExpansionBlock, RagExpansionBlock]
> = {
  ACKNOWLEDGEMENT: [
    {
      phase: "ACKNOWLEDGEMENT",
      topic: { ko: "감정 명명", en: "Naming the feeling" },
      exampleSituation: {
        ko: "리더가 화를 내며 회의를 끝냈다. 나는 아무 말도 못 했다.",
        en: "A leader ended the meeting angry; I stayed silent.",
      },
      coachingResponse: {
        ko: "‘지금 내 안에 무엇이 올라왔는지’ 한 단어로만 짚고, 판단은 미룬다.",
        en: "Name one word for what rose in you; defer judgment one beat.",
      },
    },
    {
      phase: "ACKNOWLEDGEMENT",
      topic: { ko: "영향 인식", en: "Noticing impact" },
      exampleSituation: {
        ko: "환자가 비용 때문에 치료를 미루겠다고 했다.",
        en: "A patient deferred care because of cost.",
      },
      coachingResponse: {
        ko: "상대의 말을 한 문장으로 요약해 되돌려주고, 내 반응 욕구를 구분한다.",
        en: "Reflect their line in one sentence, then separate urge to fix from listening.",
      },
    },
    {
      phase: "ACKNOWLEDGEMENT",
      topic: { ko: "몸의 신호", en: "Body signal" },
      exampleSituation: {
        ko: "동료가 공개적으로 나를 바로잡았다.",
        en: "A colleague corrected me in public.",
      },
      coachingResponse: {
        ko: "호흡 한 번 후 ‘무엇이 위협으로 느껴졌는지’만 말한다.",
        en: "After one breath, say only what felt threatening—nothing else yet.",
      },
    },
  ],
  REFLECTION: [
    {
      phase: "REFLECTION",
      topic: { ko: "패턴 이름 붙이기", en: "Pattern label" },
      exampleSituation: {
        ko: "스트레스일수록 나는 말을 많이 한다.",
        en: "Under stress I talk more and listen less.",
      },
      coachingResponse: {
        ko: "이 패턴에 짧은 별명을 붙이고, 다음 한 번만 반대로 행동할 실험을 정한다.",
        en: "Give the pattern a short nickname; pick one opposite micro-experiment next time.",
      },
    },
    {
      phase: "REFLECTION",
      topic: { ko: "이해관계자 맵", en: "Stakeholder map" },
      exampleSituation: {
        ko: "팀과 환자 요구가 동시에 밀어닥친다.",
        en: "Team and patient demands collide at once.",
      },
      coachingResponse: {
        ko: "세 칸 표로 ‘누가 무엇을 두려워하는지’만 적는다. 해결은 다음 단계.",
        en: "Sketch a 3-box fear map—no solutions yet.",
      },
    },
    {
      phase: "REFLECTION",
      topic: { ko: "책임 vs 통제", en: "Responsibility vs control" },
      exampleSituation: {
        ko: "내가 통제할 수 없는 변수에 죄책감이 남는다.",
        en: "I feel guilt over variables I can’t control.",
      },
      coachingResponse: {
        ko: "통제 가능한 행동 하나와 불가능한 조건 하나를 분리해 쓴다.",
        en: "List one controllable action vs one uncontrollable condition.",
      },
    },
  ],
  REINTEGRATION: [
    {
      phase: "REINTEGRATION",
      topic: { ko: "합의 문장", en: "Alignment sentence" },
      exampleSituation: {
        ko: "프론트와 클리닉이 서로 다른 우선순위를 말한다.",
        en: "Front desk and clinic state different priorities.",
      },
      coachingResponse: {
        ko: "‘우리가 함께 지키려는 기준 한 줄’을 합의 문장으로 만든다.",
        en: "Co-author one line: the standard we both protect.",
      },
    },
    {
      phase: "REINTEGRATION",
      topic: { ko: "작은 프로토콜", en: "Tiny protocol" },
      exampleSituation: {
        ko: "같은 실수가 주 단위로 반복된다.",
        en: "The same mistake repeats weekly.",
      },
      coachingResponse: {
        ko: "체크리스트 3줄과 담당 한 명만 정하고 2주 시험한다.",
        en: "Define a 3-line checklist + one owner for a 2-week trial.",
      },
    },
    {
      phase: "REINTEGRATION",
      topic: { ko: "수복 대화", en: "Repair talk" },
      exampleSituation: {
        ko: "지난 갈등 후 팀 분위기가 어색하다.",
        en: "The team feels awkward after conflict.",
      },
      coachingResponse: {
        ko: "사과가 아니라 영향 인정 한 문장으로 문을 연다.",
        en: "Open with impact acknowledgment—not a speech, one sentence.",
      },
    },
  ],
  RENEWAL: [
    {
      phase: "RENEWAL",
      topic: { ko: "새로운 기본값", en: "New default" },
      exampleSituation: {
        ko: "회복 후에도 예전 습관으로 돌아갈까 두렵다.",
        en: "After recovery, I fear sliding into old habits.",
      },
      coachingResponse: {
        ko: "‘지금의 기본 행동 한 가지’를 주간으로 선언하고 공유한다.",
        en: "Declare one weekly default behavior and share it aloud.",
      },
    },
    {
      phase: "RENEWAL",
      topic: { ko: "에너지 예산", en: "Energy budget" },
      exampleSituation: {
        ko: "모든 요청에 예전처럼 ‘좋아’라고 하고 싶다.",
        en: "I want to say yes to everything like before.",
      },
      coachingResponse: {
        ko: "주당 ‘예스 슬롯’ 수를 정하고 나머지는 명시적으로 보류한다.",
        en: "Cap weekly yes-slots; park the rest with a clear later date.",
      },
    },
    {
      phase: "RENEWAL",
      topic: { ko: "성장 지표", en: "Growth signal" },
      exampleSituation: {
        ko: "성과는 좋은데 공허함이 남는다.",
        en: "Performance is fine but I feel hollow.",
      },
      coachingResponse: {
        ko: "숫자 말고 관계·무결·회복 중 하나를 주간 신호로 고른다.",
        en: "Pick one weekly signal: relationship, integrity, or recovery—not a metric.",
      },
    },
  ],
};

function pickBlockIndex(phase: HealingPhase, userId: string | undefined): 0 | 1 | 2 {
  const key = `${phase}:${userId ?? ""}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h + key.charCodeAt(i)) % 3;
  }
  return h as 0 | 1 | 2;
}

function formatBlock(block: RagExpansionBlock, locale: "ko" | "en"): string {
  const t = locale === "ko" ? block.topic.ko : block.topic.en;
  const ex = locale === "ko" ? block.exampleSituation.ko : block.exampleSituation.en;
  const co = locale === "ko" ? block.coachingResponse.ko : block.coachingResponse.en;
  const labels =
    locale === "ko"
      ? { topic: "주제", ex: "예시 상황", coach: "코칭 응답 패턴" }
      : { topic: "Topic", ex: "Example situation", coach: "Coaching response pattern" };
  return [`[${labels.topic}] ${t}`, `${labels.ex}: ${ex}`, `${labels.coach}: ${co}`].join("\n");
}

/**
 * Appends **one** phase-matched expansion block (deterministic by `userId`) to {@link MentorContext.mentorRagExpansionLines}.
 */
export function expandContextByPhase(
  ctx: MentorContext,
  phase: HealingPhase,
  locale: "ko" | "en" = "ko",
): MentorContext {
  const triple = RAG_EXPANSION_BANK[phase];
  if (!triple) {
    return { ...ctx, mentorRagExpansionLines: undefined };
  }
  const idx = pickBlockIndex(phase, ctx.userId);
  const block = triple[idx]!;
  const line = formatBlock(block, locale);
  return {
    ...ctx,
    mentorRagExpansionLines: [line],
  };
}
