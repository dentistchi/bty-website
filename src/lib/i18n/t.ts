/**
 * BTY Arena Storybook / UI 컴포넌트용 i18n 키–문구 매핑.
 * 앱 전역 i18n은 src/lib/i18n.ts 등과 연동해 확장.
 */
type Locale = "ko" | "en";

const dict = {
  "common.retry": { ko: "다시 시도", en: "Retry" },
  "common.refresh": { ko: "새로고침", en: "Refresh" },
  "arena.start_simulation": { ko: "시뮬레이션 시작", en: "Start Simulation" },
  "center.safe_here": { ko: "이곳은 안전한 공간입니다.", en: "You are safe here." },
  "empty.title": { ko: "표시할 내용이 없습니다.", en: "Nothing to show." },
  "empty.desc": {
    ko: "데이터가 준비되면 여기에 표시됩니다.",
    en: "Data will appear here when available.",
  },
} as const;

export function t(key: keyof typeof dict, locale: Locale): string {
  return dict[key][locale];
}
