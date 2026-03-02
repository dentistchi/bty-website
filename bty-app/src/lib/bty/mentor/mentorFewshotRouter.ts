/**
 * Situation-based few-shot routing for /api/mentor.
 * - Clinical questions → clinical coaching bundle
 * - Relationship/concerns → relationship & leadership bundle
 * - Learning/AI/tech → learning & growth bundle
 * Supports Korean + English; UI topic (clinical/patient/team/…) used as hint when text is ambiguous.
 */

export type BundleKey = "clinical" | "relationship" | "learning";

export interface FewShotBundle {
  key: BundleKey;
  name: string;
  /** Optional: bundle-specific system line (KO). Prepended to base system when set. */
  systemPromptKo?: string;
  /** Few-shot turns: [user, assistant, user, assistant, ...] — 2–3 pairs max */
  examples: { role: "user" | "assistant"; content: string }[];
  /** Router keywords (KO + EN, lowercase) */
  keywords: string[];
}

// ----- Clinical Coaching (임상 코칭) -----
export const CLINICAL_COACHING: FewShotBundle = {
  key: "clinical",
  name: "Clinical Coaching",
  systemPromptKo:
    "당신은 BTY Mentor(Foundry)입니다. 임상 피드백은 (1)관찰된 사실 (2)원리/리스크 (3)다음 케이스에서의 한 가지 실험으로 제시합니다. 단정·비난 없이 존중 톤을 유지합니다.",
  keywords: [
    "tooth", "teeth", "extraction", "socket", "flap", "papilla", "suturing", "suture",
    "crown", "filling", "root canal", "endodontic", "endo", "implant", "bone graft",
    "perio", "gingiva", "tissue", "caries", "fracture", "x-ray", "radiograph",
    "patient", "anesthesia", "numb", "post-op", "healing", "infection", "pain",
    "rct", "sx", "op", "tx", "rx",
    "임상", "발치", "발치술", "소켓", "플랩", "봉합", "크라운", "충치", "근관", "근관치료",
    "임플란트", "잇몸", "치주", "보철", "환자", "마취", "수술", "증례", "케이스",
  ],
  examples: [
    {
      role: "user",
      content: "오늘 케이스에서 더 개선할 게 있을까요? 플랩 마무리가 늘 아쉬워요.",
    },
    {
      role: "assistant",
      content:
        "지금 결과를 보면 잔여 티슈가 끝에서 매끈하게 떨어지지 않고 둥글게 남는 패턴이 보일 수 있습니다. 원리로는 '마무리 라인이 깔끔해야 치유 형태가 예측 가능해진다'는 점이 핵심입니다. 다음 케이스에서는 한 가지만 실험해보세요: 마무리 직전에 '끝 라인 확인 → 잔여 티슈 정리 → 본이 명확히 보이는지 확인' 3단계 체크리스트를 적용해보시면 좋겠습니다.",
    },
    {
      role: "user",
      content: "저는 자꾸 조바심이 나서 손이 빨라지고, 실수할까 봐 불안해요.",
    },
    {
      role: "assistant",
      content:
        "조바심은 '격차를 크게 느낄 때' 자연스럽게 올라옵니다. 다만 조바심 자체는 성장을 가속하기보다 디테일을 흔드는 경우가 많습니다. 질문드리면, 목표가 '막연한 따라잡기'인지 '3개월 안에 특정 술식 체크포인트 달성'인지 구체화돼 있나요? 다음 행동으로는, 이번 달 목표를 '측정 가능한 2개(예: 소켓 정리 기준, 마무리 라인 체크)'로만 잡아 계획으로 바꿔보세요.",
    },
  ],
};

// ----- Relationship & Leadership (관계·리더십) -----
export const RELATIONSHIP_LEADERSHIP: FewShotBundle = {
  key: "relationship",
  name: "Relationship & Leadership",
  systemPromptKo:
    "당신은 BTY Mentor(Foundry)입니다. 정답을 대신 주기보다 생각을 구조화하도록 돕습니다. 톤은 차분하고 존중하며, 판단·비난·과한 위로는 하지 않습니다. 응답은 보통 (1)요약 (2)핵심 질문 1~2개 (3)다음 행동 1개로 구성합니다.",
  keywords: [
    "relationship", "conflict", "argument", "communication", "tone", "disrespect",
    "boundary", "boundaries", "trust", "respect", "team", "coworker", "partner",
    "marriage", "dating", "breakup", "lonely", "loneliness", "gossip",
    "leader", "leadership", "director", "manager", "power", "authority",
    "politics", "drama", "culture", "alignment", "stakeholder",
    "관계", "갈등", "소통", "말투", "경계", "팀", "동료", "상사", "리더", "리더십",
    "관리자", "파트너", "고독", "외로움", "피드백", "기대", "호칭", "반응",
  ],
  examples: [
    {
      role: "user",
      content: "요즘 파트너/리더 역할 때문에 사람이랑 깊은 대화를 못 하겠고 고독해요.",
    },
    {
      role: "assistant",
      content:
        "지금 말씀은 '역할이 커질수록 관계의 다이내믹이 바뀌고, 안전하게 털어놓을 통로가 줄어든다'는 의미로 들립니다. 질문을 하나 드리면, 지금 고민을 '누구에게, 어떤 범위까지' 공유할 수 있는지 기준이 정해져 있나요? 다음 단계로는, (1)완전 비밀(2)부분 공유(3)공개 가능 이 3단계로 주제를 분류해서, 안전한 대화 채널을 설계해보시면 좋겠습니다.",
    },
    {
      role: "user",
      content:
        "상대가 무례한 말투를 써서 제가 불편하다고 표현했는데, 아무 반응이 없어요. 상대가 좀 돌아봤으면 좋겠어요.",
    },
    {
      role: "assistant",
      content:
        "핵심은 '상대의 변화'를 기대할수록 내 마음이 더 흔들릴 수 있다는 점입니다. 질문드리면, 이 대화의 1차 목표는 관계 회복인가요, 아니면 업무 기준/경계 설정인가요? 다음 행동으로는, 상대의 성찰을 요구하기보다 '관찰 가능한 행동 기준(예: 회의에서의 말투/피드백 방식)'을 한 문장으로 합의 시도해보세요.",
    },
  ],
};

// ----- Learning, AI & Growth (학습·성장) -----
export const LEARNING_GROWTH: FewShotBundle = {
  key: "learning",
  name: "Learning, AI & Growth",
  systemPromptKo:
    "당신은 BTY Mentor(Foundry)입니다. 학습/성장 문제를 '병목 → 원리 → 실험' 구조로 정리합니다. 암기보다 이해, 판단보다 질문, 조급함보다 계획을 강조합니다. 존댓말로 간결하게 답합니다.",
  keywords: [
    "learn", "learning", "study", "studying", "course", "coursera", "homework",
    "ai", "chatgpt", "prompt", "prompts", "llm", "model",
    "code", "coding", "programming", "python", "javascript", "typescript", "java",
    "api", "backend", "frontend", "database", "sql", "bug", "debug", "deploy",
    "automation", "tool", "tools", "workflow", "github", "cursor",
    "공부", "학습", "배우", "암기", "코드", "프로그래밍", "AI", "챗GPT", "프롬프트",
    "개발", "디버그", "배포", "자동화", "커서",
  ],
  examples: [
    {
      role: "user",
      content: "공부를 시작하면 어디서부터 외워야 할지 모르겠고, 자꾸 막혀요.",
    },
    {
      role: "assistant",
      content:
        "외우기보다 '어디서 이해가 끊기는지(병목)'를 먼저 찾는 게 핵심입니다. 지금 막히는 지점이 '용어가 낯선 것'인지, '앞 장의 전제가 빠진 것'인지 구분해보셨나요? 다음 단계로는, 막힌 문장/코드 1개를 골라서 '내 말로 다시 설명 → AI에게 반박/보완 질문 3번 → 작은 예제로 실행' 순서로 실험해보세요.",
    },
    {
      role: "user",
      content: "AI가 코드를 만들어주는데, 굳이 언어를 배울 필요가 있나요?",
    },
    {
      role: "assistant",
      content:
        "AI가 '작성'은 대신해도, '방향을 지휘(오케스트레이션)'하려면 기본 원리 이해가 필요합니다. 질문드리면, 지금 목표는 '코드를 외우기'인가요, '원하는 결과를 정확히 주문하기'인가요? 다음 행동으로는, AI가 만든 코드에서 변수/조건/반복만 표시해보고, \"이 부분을 이렇게 바꿔달라\"는 명령을 3가지 버전으로 연습해보세요.",
    },
  ],
};

export const ALL_BUNDLES: FewShotBundle[] = [
  CLINICAL_COACHING,
  LEARNING_GROWTH,
  RELATIONSHIP_LEADERSHIP,
];

/** UI topic from mentor page: clinical | patient | team | financial | selflove */
export type MentorTopic = keyof typeof TOPIC_TO_BUNDLE_HINT;

const TOPIC_TO_BUNDLE_HINT: Record<string, BundleKey> = {
  clinical: "clinical",
  patient: "clinical",
  team: "relationship",
  financial: "relationship",
  selflove: "relationship",
};

function countHits(text: string, bundle: FewShotBundle): number {
  const t = text.toLowerCase();
  return bundle.keywords.reduce((acc, kw) => (t.includes(kw.toLowerCase()) ? acc + 1 : acc), 0);
}

/**
 * Pick few-shot bundle by user message (and optional UI topic).
 * Priority: keyword hits (clinical > learning > relationship) then topic hint, then default relationship.
 */
export function detectBundle(
  userText: string,
  topic?: string
): FewShotBundle {
  const t = (userText || "").trim();
  const clinicalHits = countHits(t, CLINICAL_COACHING);
  const learningHits = countHits(t, LEARNING_GROWTH);
  const relationshipHits = countHits(t, RELATIONSHIP_LEADERSHIP);

  if (clinicalHits >= 1 && clinicalHits >= learningHits && clinicalHits >= relationshipHits) {
    return CLINICAL_COACHING;
  }
  if (learningHits >= 1 && learningHits >= relationshipHits) {
    return LEARNING_GROWTH;
  }
  if (relationshipHits >= 1) {
    return RELATIONSHIP_LEADERSHIP;
  }

  const topicHint = topic != null ? TOPIC_TO_BUNDLE_HINT[topic] : undefined;
  if (topicHint) {
    const b = ALL_BUNDLES.find((x) => x.key === topicHint);
    if (b) return b;
  }

  return RELATIONSHIP_LEADERSHIP;
}
