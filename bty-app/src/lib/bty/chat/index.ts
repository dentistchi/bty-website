/**
 * BTY Chat — 완전 드롭인
 *
 * 사용처:
 * - POST /api/chat: 타입 + buildChatMessagesForModel + normalizeMode + getFallbackMessage + chatGuards
 * - 다른 클라이언트/서비스: 동일 body 구조로 요청하거나, buildChatMessagesForModel로 모델 호출 payload 생성
 */

export type {
  ChatMode,
  ChatRequestBody,
  ChatResponseBody,
  ChatErrorBody,
  ChatConversationMessage,
  OpenAIChatMessage,
  ChatMessagesForModel,
} from "./types";

export {
  buildChatMessagesForModel,
  normalizeMode,
  getFallbackMessage,
} from "./buildChatMessages";

export {
  isLowSelfEsteemSignal,
  isDojoRecommendSignal,
  getSafetyValveMessage,
  getDojoRecommendMessage,
  detectLang,
  filterBtyResponse,
  SAFETY_VALVE_MESSAGE_KO,
  SAFETY_VALVE_MESSAGE_EN,
  DOJO_RECOMMEND_MESSAGE_KO,
  DOJO_RECOMMEND_MESSAGE_EN,
} from "./chatGuards";
