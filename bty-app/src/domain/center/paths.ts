/**
 * Center 경로·이벤트 상수 (§5·§6 CENTER_PAGE_IMPROVEMENT_SPEC).
 * 비즈니스 규칙: CTA 목적지 = /bty(보호된 경로), 챗 열기 = open-chatbot 이벤트.
 * UI/API는 이 도메인 값만 사용.
 */

/** §5: Center CTA(문 열고 나가기 등) 클릭 시 이동 경로. locale 없이 경로만. */
export const CENTER_CTA_PATH = "/bty";

/** §6: "챗으로 이어하기" 클릭 시 챗 패널을 여는 커스텀 이벤트 이름. */
export const CENTER_CHAT_OPEN_EVENT = "open-chatbot";

/** Center CTA 등에서 locale 미제공 시 사용할 기본 locale. */
export const CENTER_DEFAULT_LOCALE = "ko";

/** locale이 주어졌을 때 Center CTA 전체 경로. */
export function getCenterCtaHref(locale: string): string {
  return `/${locale}${CENTER_CTA_PATH}`;
}
