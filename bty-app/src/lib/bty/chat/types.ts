/**
 * BTY Chat — API 계약 타입 (완전 드롭인)
 * POST /api/chat 요청/응답 및 모델 호출용 메시지 형식.
 */

export type ChatMode = "dearme" | "dojo" | "arena";

/** 대화 메시지 (클라이언트 → API body.messages) */
export interface ChatConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/** POST /api/chat 요청 body */
export interface ChatRequestBody {
  messages: ChatConversationMessage[];
  mode?: ChatMode | "today-me" | "bty"; // legacy 지원
  lang?: "ko" | "en";
}

/** POST /api/chat 성공 응답 (200) */
export interface ChatResponseBody {
  message: string;
  mode?: ChatMode;
  suggestDearMe?: boolean;
  suggestDojo?: boolean;
  suggestMentor?: boolean;
  mentorPath?: string;
  /** true when API failed and fallback message was returned */
  usedFallback?: boolean;
}

/** POST /api/chat 에러 응답 (4xx/5xx) */
export interface ChatErrorBody {
  error: string;
}

/** OpenAI 등 채팅 모델에 넘길 메시지 (system + few-shot + history) */
export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** buildChatMessagesForModel 반환 타입 */
export type ChatMessagesForModel = OpenAIChatMessage[];
