# Arena Hub CTA Policy

허브(`/[locale]/bty-arena`)는 **실행 전 정렬**이지 대시보드가 아님. 아래를 벗어나는 확장은 IA 리뷰 대상.

## Primary CTA

- **이어할 로컬 세션 있음** (`btyArenaState:v1`, phase ≠ `DONE`): **Continue** → `/bty-arena/play`
- **없음**: **Play Game** → `/bty-arena/play`

## Secondary CTA

- 이어하기 가능 시: **Play Game** (새 진입과 동일 라우트; 플레이 화면에서 리셋/신규 처리)
- 이어하기 불가 시: **주간 순위** 링크 → `/bty/leaderboard` (텍스트 링크만)

## 금지 / 지양

- 허브에 시나리오 id, 남은 시간, 세션 메타데이터 상세 노출
- 대시보드형 카드·위젯 확장
- 주간/시즌 **계산**을 UI에서 중복 (표시는 API 결과만)

## 관련 코드

- 진입 카드: `components/bty-arena/ArenaHubEntryCard.tsx`
- 요약(순위·시즌): `components/bty-arena/ArenaHubSummary.tsx`
- 라우트 맵: `docs/GROWTH_IA_ROUTE_MAP.md`
- E2E(허브 public / 인증 분리): `docs/E2E_ARENA.md`
