/**
 * BTY Chat — 안전 밸브 & Dojo 추천 (드롭인에서 함께 사용)
 */

const LOW_SELF_ESTEEM_PATTERNS = [
  /못하겠어/i,
  /못하겠다/i,
  /자격\s*이?\s*없어/i,
  /자격\s*없다/i,
  /너무\s*힘들어/i,
  /너무\s*힘들다/i,
  /진짜\s*힘들어/i,
  /지쳐/i,
  /포기/i,
  /그만둘게/i,
  /그만둬/i,
  /안\s*돼/i,
  /못\s*해/i,
  /쓸모없/i,
  /가치\s*없/i,
  /의미\s*없/i,
];

const DOJO_RECOMMEND_PATTERNS = [
  /배우고\s*싶/i,
  /어떻게\s*해야/i,
  /연습하고\s*싶/i,
  /도와\s*줘/i,
  /가이드|가르쳐|알려\s*줘/i,
  /how\s*to/i,
  /learn\s*(to|about|how)/i,
  /want\s*to\s*(learn|practice)/i,
  /need\s*to\s*learn/i,
  /help\s*me\s*(with|to)/i,
  /practice\s*(with|together)/i,
  /teach\s*me/i,
  /멘토|mentor/i,
  /역지사지|다른\s*사람\s*입장/i,
];

export const SAFETY_VALVE_MESSAGE_KO =
  "잠깐만요, 지금 많이 지쳐 보여요. 기술을 배우는 것보다 마음을 돌보는 게 먼저인 것 같네요. 우리 Dear Me로 가서 잠시 쉬고 올까요? 거기서 당신의 마음 상태를 체크해보고 오세요.";
export const SAFETY_VALVE_MESSAGE_EN =
  "You seem really worn out right now. Taking care of your heart might come before anything else. How about resting for a moment in Dear Me? You can check in with how you're feeling there.";

export const DOJO_RECOMMEND_MESSAGE_KO =
  "연습이나 배움이 필요하시다면 훈련장(Dojo)이 좋아요. Dr. Chi 멘토와 대화하거나 역지사지 시뮬레이터로 갈등 상황을 돌려볼 수 있어요.";
export const DOJO_RECOMMEND_MESSAGE_EN =
  "If you want to practice or learn, the Dojo is a good place. You can talk with Dr. Chi or try the integrity simulator to reframe conflict situations.";

export function isLowSelfEsteemSignal(text: string): boolean {
  return LOW_SELF_ESTEEM_PATTERNS.some((pat) => pat.test(text));
}

export function isDojoRecommendSignal(text: string): boolean {
  return DOJO_RECOMMEND_PATTERNS.some((pat) => pat.test(text));
}

export function getSafetyValveMessage(lang: "ko" | "en"): string {
  return lang === "ko" ? SAFETY_VALVE_MESSAGE_KO : SAFETY_VALVE_MESSAGE_EN;
}

export function getDojoRecommendMessage(lang: "ko" | "en"): string {
  return lang === "ko" ? DOJO_RECOMMEND_MESSAGE_KO : DOJO_RECOMMEND_MESSAGE_EN;
}

/**
 * 언어 보정: 클라이언트 lang + 마지막 사용자 메시지 한글 여부.
 * 마지막 메시지에 한글이 있으면 "ko" 우선.
 */
export function detectLang(clientLang: string | undefined, lastUserMessage: string): "ko" | "en" {
  const msg = lastUserMessage ?? "";
  if (/[\uac00-\ud7a3]/.test(msg)) return "ko";
  if (clientLang === "ko" || clientLang === "en") return clientLang;
  return "en";
}

/** Dojo/bty 모드에서 위로·안심 문구 감지 시 대체 문장 (훈련 톤 유지) */
const COMFORT_PATTERNS = [
  /괜찮아요|괜찮습니다|안심하세요|힘내세요|잘\s*될\s*거예요|you're safe|it's okay|don't worry|you'll be fine|안전한\s*곳|안전해요/i,
];
const FILTER_REPLACEMENT_KO =
  "그런 말이 나오는 건 자연스러워요. 한 가지만 여쭤볼게요: 지금 가장 먼저 정리하고 싶은 건 무엇인가요?";
const FILTER_REPLACEMENT_EN =
  "That's a natural thing to say. One question: what do you most want to clarify right now?";

export function filterBtyResponse(text: string, lang: "ko" | "en"): string {
  const t = (text || "").trim();
  if (!t) return t;
  const isComfort = COMFORT_PATTERNS.some((re) => re.test(t));
  return isComfort ? (lang === "ko" ? FILTER_REPLACEMENT_KO : FILTER_REPLACEMENT_EN) : t;
}

/** 메타 질문("챗봇이야?", "AI야?", "너 누구야?" 등) 감지 — PROJECT_BACKLOG §9, CHATBOT_TRAINING_CHECKLIST §3 */
const META_QUESTION_PATTERNS = [
  /^(너\s*누구야?|넌\s*누구야?|너는\s*누구야?|who\s*are\s*you|what\s*are\s*you)\s*[.?]?$/i,
  /^(챗봇이야?|챗봇\s*맞아?|로봇이야?|AI야?|인공지능이야?|봇이야?|bot\?|are\s*you\s*(a\s*)?bot|are\s*you\s*ai|is\s*this\s*a\s*chatbot)\s*[.?]?$/i,
  /^(실제\s*사람이야?|진짜\s*사람이야?|사람이야?|are\s*you\s*real|are\s*you\s*human)\s*[.?]?$/i,
];

export function isMetaQuestion(text: string): boolean {
  const t = (text || "").trim();
  return META_QUESTION_PATTERNS.some((re) => re.test(t));
}

const META_REPLY_KO =
  "저는 BTY Chat이에요. 이 공간에서 생각과 감정을 단계적으로 정리하도록 돕습니다. 더 말하고 싶은 게 있으면 편하게 이어서 말해 주세요.";
const META_REPLY_EN =
  "I'm BTY Chat. I help you sort out your thoughts and feelings step by step here. If you'd like to continue, just say what's on your mind.";

export function getMetaReply(lang: "ko" | "en"): string {
  return lang === "ko" ? META_REPLY_KO : META_REPLY_EN;
}
