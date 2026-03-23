/**
 * Dr. Chi RAG — structured coaching examples by Arena `flag_type` (CHOICE_CONFIRMED history).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MentorContext } from "@/engine/rag/mentor-context.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export type FlagType = "HERO_TRAP" | "INTEGRITY_SLIP" | "CLEAN" | "ROLE_MIRROR";

type Bilingual = { ko: string; en: string };

/** Localized example for UI / RAG (from {@link getExamplesByFlagType}). */
export type MentorExample = {
  situation: string;
  distortion: string;
  correction: string;
  outcome: string;
};

/** Bilingual bank entry (KO + EN). */
export type MentorExampleBilingual = {
  situation: Bilingual;
  distortion: Bilingual;
  correction: Bilingual;
  outcome: Bilingual;
};

function loc(row: MentorExampleBilingual, locale: "ko" | "en"): MentorExample {
  return {
    situation: row.situation[locale],
    distortion: row.distortion[locale],
    correction: row.correction[locale],
    outcome: row.outcome[locale],
  };
}

function ex(
  situation: [string, string],
  distortion: [string, string],
  correction: [string, string],
  outcome: [string, string],
): MentorExampleBilingual {
  return {
    situation: { ko: situation[0], en: situation[1] },
    distortion: { ko: distortion[0], en: distortion[1] },
    correction: { ko: correction[0], en: correction[1] },
    outcome: { ko: outcome[0], en: outcome[1] },
  };
}

/** Five bilingual coaching patterns per flag (KO first tuple element, EN second). */
export const EXAMPLE_BANK: Record<FlagType, MentorExampleBilingual[]> = {
  HERO_TRAP: [
    ex(
      [
        "팀 앞에서 후배의 실수를 바로잡으며 내가 영웅처럼 보이려 했다.",
        "I corrected a junior in front of the team to look like the hero who saves the day.",
      ],
      [
        "‘내가 없으면 안 된다’는 과시가 관계를 수직으로 만든다.",
        "The distortion is proving ‘they can’t succeed without me,’ which turns peers into an audience.",
      ],
      [
        "사적으로 피드백하고, 공개 자리에서는 그들의 시도를 먼저 인정한다.",
        "Give feedback privately; in public, credit their intent before coaching the gap.",
      ],
      [
        "팀이 스스로 말하게 되고, 나는 조정자 역할로 남는다.",
        "The team speaks up more; you stay the facilitator, not the spotlight.",
      ],
    ),
    ex(
      [
        "환자 사례 회의에서 나만 정답을 말하며 흐름을 독점했다.",
        "I dominated the case review by delivering the only ‘right’ answer.",
      ],
      [
        "전문성이 곧 통제로 바뀌어 다른 목소리를 죽인다.",
        "Expertise becomes control; other voices go quiet.",
      ],
      [
        "한 명씩 먼저 관찰을 공유하게 한 뒤, 내 해석은 마지막에 덧붙인다.",
        "Invite observations first; add your synthesis last.",
      ],
      [
        "케이스 품질은 올라가고, 나는 코디네이터로 인식된다.",
        "Case quality rises; you’re seen as coordinator, not savior.",
      ],
    ),
    ex(
      [
        "위기 상황에서 내가 직접 뛰어들어 모든 결정을 대신 내렸다.",
        "In a crisis I jumped in and made every call myself.",
      ],
      [
        "긴급함이 ‘나만 믿어라’는 무형의 의존을 남긴다.",
        "Urgency trains others to wait for you instead of thinking.",
      ],
      [
        "즉시 조치는 최소화하고, 다음엔 누가 무엇을 할지 역할만 분명히 나눈다.",
        "Do the minimum rescue now; next time assign clear owners and steps.",
      ],
      [
        "반복 위기에서 팀이 먼저 프로토콜을 찾기 시작한다.",
        "In repeats, the team reaches for protocol before calling you.",
      ],
    ),
    ex(
      [
        "슬랙에서 내가 해결했다는 스레드를 길게 남겨 인정을 모았다.",
        "I left a long Slack thread showing I fixed it, chasing recognition.",
      ],
      [
        "인정 욕구가 투명해지면 동료는 조용히 물러난다.",
        "When credit-seeking is visible, peers step back quietly.",
      ],
      [
        "요약 한 줄 + 다음 주인만 태그하고 스레드를 닫는다.",
        "Close with one-line summary and tag the owner for follow-up.",
      ],
      [
        "감사 표현이 팀 전체로 향하고, 나는 연결자로 남는다.",
        "Thanks spread across the team; you stay the connector.",
      ],
    ),
    ex(
      [
        "교육 세션에서 질문을 가로채 답을 대신했다.",
        "In training I intercepted questions and answered for others.",
      ],
      [
        "빠른 답이 학습 기회를 빼앗는다.",
        "Fast answers steal learning moments.",
      ],
      [
        "5초 침묵 후, 질문한 사람에게 먼저 되묻는다.",
        "Wait five seconds; ask the asker what they already think.",
      ],
      [
        "참가자가 스스로 틀리고 고치는 패턴이 생긴다.",
        "Participants practice self-correction in the room.",
      ],
    ),
  ],
  INTEGRITY_SLIP: [
    ex(
      [
        "바쁜 날 환자에게 권장 치료를 과장해 설명했다.",
        "On a busy day I overstated the need for a recommended treatment.",
      ],
      [
        "매출 압박이 임상 판단과 섞였다.",
        "Production pressure blended into clinical judgment.",
      ],
      [
        "필요·선택·리스크를 구분한 문장으로 다시 정리한다.",
        "Restate clearly what is needed vs optional and the tradeoffs.",
      ],
      [
        "환자가 서명 전에 질문을 더 하고, 나는 같은 속도로 답한다.",
        "The patient asks more before consent; you answer calmly.",
      ],
    ),
    ex(
      [
        "보험 청구를 위해 진단 코드를 애매하게 올렸다.",
        "I nudged a code upward to help insurance billing.",
      ],
      [
        "작은 타협이 기록의 신뢰를 깎는다.",
        "Small compromises erode chart trust.",
      ],
      [
        "정확한 코드로 고치고, 필요하면 재교육을 요청한다.",
        "Correct the record; request billing education if needed.",
      ],
      [
        "리스크가 문서에 남고, 팀 기준이 다시 선명해진다.",
        "Risk is documented; team standards sharpen.",
      ],
    ),
    ex(
      [
        "동료가 늦어 내가 그의 환자 서류를 대신 서명했다.",
        "I signed paperwork for a colleague’s patient when they were late.",
      ],
      [
        "‘돕는다’는 이름의 경계 침범이다.",
        "It is boundary crossing disguised as help.",
      ],
      [
        "즉시 담당자에게 넘기고, 환자에게는 솔직히 지연을 설명한다.",
        "Hand off immediately; explain the delay honestly to the patient.",
      ],
      [
        "프로토콜이 강화되고, 나는 모범 사례로 기록된다.",
        "Protocol tightens; you model the fix.",
      ],
    ),
    ex(
      [
        "스트레스로 차트에 불필요한 비난적 표현을 남겼다.",
        "Under stress I left judgmental wording in the chart.",
      ],
      [
        "기록이 감정을 담으면 돌이키기 어렵다.",
        "Charts that carry emotion are hard to unwind.",
      ],
      [
        "객관적 사실만 남기고 감정은 별 메모로 옮긴다.",
        "Keep objective facts; move emotion to a private note.",
      ],
      [
        "감사에서 표현이 중립으로 바뀌고, 나는 다시 신뢰를 회복한다.",
        "Documentation reads neutral; trust repairs.",
      ],
    ),
    ex(
      [
        "리더에게 좋게 보이려 숫자를 부드럽게 보고했다.",
        "I softened numbers to look good to leadership.",
      ],
      [
        "단기 호감이 장기 신뢰를 판다.",
        "Short-term approval trades long-term trust.",
      ],
      [
        "원본 지표를 제시하고, 해석의 한계를 명시한다.",
        "Show raw metrics and state limits of interpretation.",
      ],
      [
        "대화가 현실 기반으로 돌아가고, 결정이 나아진다.",
        "Decisions improve once grounded in facts.",
      ],
    ),
  ],
  CLEAN: [
    ex(
      [
        "갈등 직후에도 프로토콜대로 핸드오프를 끝까지 마쳤다.",
        "After conflict I still completed the handoff exactly by protocol.",
      ],
      [
        "감정과 역할을 분리하지 못하면 품질이 흔들린다.",
        "If emotion and role blur, quality wobbles.",
      ],
      [
        "짧은 호흡 후 체크리스트만 읽는다.",
        "Take a breath; read the checklist only.",
      ],
      [
        "팀이 ‘지금은 표준만’이라는 신호를 받는다.",
        "The team sees ‘standards first’ as the signal.",
      ],
    ),
    ex(
      [
        "환자가 화를 내도 목소리 톤을 낮추고 사실만 반복했다.",
        "Even when the patient was angry, I lowered tone and repeated facts.",
      ],
      [
        "방어가 아니라 안정이 응답이다.",
        "Stability, not defense, is the response.",
      ],
      [
        "한 문장 요약 → 다음 선택지 두 가지를 제시한다.",
        "One-sentence summary, then two clear options.",
      ],
      [
        "긴장이 가라앉고 합의 지점이 보인다.",
        "Tension drops; a shared next step appears.",
      ],
    ),
    ex(
      [
        "실수를 숨기지 않고 즉시 팀에 알렸다.",
        "I disclosed a mistake to the team immediately.",
      ],
      [
        "숨김은 불안을 키운다.",
        "Hiding grows anxiety.",
      ],
      [
        "영향·조치·모니터링을 한 페이지에 적는다.",
        "Write impact, action, monitoring on one page.",
      ],
      [
        "신뢰가 빠르게 회복되고 프로세스가 개선된다.",
        "Trust rebounds fast; the process improves.",
      ],
    ),
    ex(
      [
        "야간 근무 후에도 리콜 규칙을 건너뛰지 않았다.",
        "After a night shift I still followed recall rules.",
      ],
      [
        "피로가 절차를 ‘선택’으로 만든다.",
        "Fatigue turns procedure into optional.",
      ],
      [
        "5분 지연을 허용하되, 문서는 지금 남긴다.",
        "Allow five minutes delay but chart now.",
      ],
      [
        "실수율이 떨어지고 후배가 기준을 본다.",
        "Error rate drops; juniors see the bar.",
      ],
    ),
    ex(
      [
        "비용 논의가 불편해도 견적 범위를 숨기지 않았다.",
        "Even when cost talk was awkward, I didn’t hide estimate ranges.",
      ],
      [
        "회피가 신뢰를 깎는다.",
        "Avoidance erodes trust.",
      ],
      [
        "범위·가정·대안을 같은 슬라이드에 적는다.",
        "Put range, assumptions, alternatives on one slide.",
      ],
      [
        "환자가 정보를 가지고 결정한다.",
        "The patient decides with information.",
      ],
    ),
  ],
  ROLE_MIRROR: [
    ex(
      [
        "환자가 ‘당신은 이해 못 해요’라고 했을 때, 내 감정부터 설명했다.",
        "When the patient said ‘you wouldn’t understand,’ I explained my feelings first.",
      ],
      [
        "내 이야기가 그들의 고통을 가렸다.",
        "My story eclipsed their pain.",
      ],
      [
        "한 문장만 반영하고, 질문을 그들에게 돌린다.",
        "Reflect one sentence, then return the question to them.",
      ],
      [
        "그들이 자기 언어로 문제를 말하기 시작한다.",
        "They start naming the issue in their words.",
      ],
    ),
    ex(
      [
        "매니저에게 ‘나는 이렇게 희생했다’로 시작했다.",
        "I opened to my manager with how much I sacrificed.",
      ],
      [
        "희생 서사가 요구를 흐린다.",
        "Sacrifice narrative blurs the ask.",
      ],
      [
        "영향·필요·요청을 세 줄로 말한다.",
        "State impact, need, request in three lines.",
      ],
      [
        "대화가 요청과 지원으로 정렬된다.",
        "The talk aligns on request and support.",
      ],
    ),
    ex(
      [
        "교육 대상자에게 내 커리어 비교를 길게 했다.",
        "I compared my career at length with the learner.",
      ],
      [
        "비교가 학습 목표를 가린다.",
        "Comparison hides their learning goal.",
      ],
      [
        "그들의 목표 한 문장을 먼저 적게 한다.",
        "Have them write one sentence goal first.",
      ],
      [
        "피드백이 그 목표에만 연결된다.",
        "Feedback ties only to that goal.",
      ],
    ),
    ex(
      [
        "갈등 중 상대 역할을 과장해 말했다.",
        "In conflict I exaggerated the other role’s motives.",
      ],
      [
        "만화화가 상대를 적으로 고정한다.",
        "Caricature locks them as enemy.",
      ],
      [
        "상대 말을 한 문장으로 요약해 확인한다.",
        "Summarize their view in one sentence and check.",
      ],
      [
        "긴장이 낮아지고 협상이 가능해진다.",
        "Tension drops; negotiation opens.",
      ],
    ),
    ex(
      [
        "후배에게 ‘내가 젊었을 땐’으로 조언을 시작했다.",
        "I started advice to a junior with ‘when I was your age.’",
      ],
      [
        "시간 여행 조언은 지금 맥락을 무시한다.",
        "Time-travel advice ignores their context.",
      ],
      [
        "지금 막힌 지점 한 가지만 묻는다.",
        "Ask for one stuck point right now.",
      ],
      [
        "조언이 짧고 실행 가능해진다.",
        "Advice becomes short and actionable.",
      ],
    ),
  ],
};

export function getExamplesByFlagType(
  flagType: FlagType,
  locale: "ko" | "en",
): MentorExample[] {
  return EXAMPLE_BANK[flagType].map((row) => loc(row, locale));
}

function formatExampleBlock(
  index: number,
  flagType: FlagType,
  ex: MentorExample,
  locale: "ko" | "en",
): string {
  const labels =
    locale === "ko"
      ? { s: "상황", d: "왜곡", c: "교정", o: "결과" }
      : { s: "Situation", d: "Distortion", c: "Correction", o: "Outcome" };
  return [
    `[${flagType} #${index}]`,
    `${labels.s}: ${ex.situation}`,
    `${labels.d}: ${ex.distortion}`,
    `${labels.c}: ${ex.correction}`,
    `${labels.o}: ${ex.outcome}`,
  ].join("\n");
}

/** Maps raw `flag_type` strings (e.g. coach intents) to example bank keys. */
export function normalizeToFlagType(raw: string | null | undefined): FlagType | null {
  const u = (raw ?? "").toUpperCase();
  if (u.includes("HERO_TRAP") || u.includes("HERO")) return "HERO_TRAP";
  if (u.includes("INTEGRITY_SLIP") || u.includes("INTEGRITY")) return "INTEGRITY_SLIP";
  if (u.includes("ROLE_MIRROR") || u.includes("MIRROR")) return "ROLE_MIRROR";
  if (u.includes("CLEAN")) return "CLEAN";
  return null;
}

async function fetchMostRecentFlagType(
  userId: string,
  supabase?: SupabaseClient,
): Promise<string | null> {
  const client = supabase ?? (await getSupabaseServerClient());
  const { data, error } = await client
    .from("user_scenario_choice_history")
    .select("flag_type")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[mentor-example-bank] fetchMostRecentFlagType", error.message);
    return null;
  }
  const ft = (data as { flag_type?: string } | null)?.flag_type;
  return typeof ft === "string" && ft.length > 0 ? ft : null;
}

const DEFAULT_FLAG: FlagType = "CLEAN";

/**
 * Loads latest `flag_type` from `user_scenario_choice_history`, maps to {@link FlagType},
 * appends **two** localized examples to {@link MentorContext.mentorExampleRagLines}.
 */
export async function injectExamplesIntoContext(
  ctx: MentorContext,
  options?: { locale?: "ko" | "en"; supabase?: SupabaseClient },
): Promise<MentorContext> {
  const locale = options?.locale ?? "ko";
  const supabase = options?.supabase;
  const userId = ctx.userId;
  if (!userId) {
    return { ...ctx, mentorExampleRagLines: undefined };
  }

  const raw = await fetchMostRecentFlagType(userId, supabase);
  const mapped = normalizeToFlagType(raw);
  const flagType: FlagType = mapped ?? DEFAULT_FLAG;

  const two = getExamplesByFlagType(flagType, locale).slice(0, 2);
  const mentorExampleRagLines = two.map((row, i) =>
    formatExampleBlock(i + 1, flagType, row, locale),
  );

  return { ...ctx, mentorExampleRagLines };
}
