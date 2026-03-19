# E2E용 `data-testid` 맵 (BTY)

카피·i18n 변경과 분리된 **구조 앵커**만 둡니다.

## Journey

| testid | 위치 |
|--------|------|
| `comeback-modal` | ComebackModal 패널 (`Modal.panelDataTestId`) |
| `comeback-modal-title` | 제목 |
| `comeback-modal-description` | 본문 1단락 |
| `resume-journey-button` | Resume Journey |
| `close-comeback-button` | Close |
| `journey-board` | JourneyBoard 루트 |
| `journey-current-day` | Day {n} 헤딩 |
| `journey-status-text` | 상태 문구 |
| `journey-continue-button` | Continue Day {n} |
| `journey-restart-button` | Restart Journey |
| `journey-day-cell-01` … `journey-day-cell-28` | 그리드 셀 |
| `restart-journey-dialog` | 재시작 모달 패널 |
| `restart-journey-confirm` / `restart-journey-cancel` | Restart / Cancel |
| `journey-day-step` | Day 스텝 페이지 루트 |
| `journey-day-title` / `journey-day-body` | 콘텐츠 |
| `journey-complete-button` / `journey-back-button` | 완료 / 뒤로 |

## Arena

| testid | 위치 |
|--------|------|
| `arena-hub` | 허브 페이지 본문 래퍼 |
| `arena-hub-card` | 진입 카드 |
| `arena-continue-button` | Continue 링크 (이어하기 시만) |
| `arena-play-button` | Play Game |
| `arena-hub-summary` | 주간·시즌 요약 영역 |
| `arena-weekly-rank` / `arena-season-ends` | 값 표시 |
| `arena-result` | 결과 페이지 루트 |
| `arena-result-core-xp` / `arena-result-weekly-xp` | XP 카드 |
| `arena-result-system-note` | 시스템 노트 |
| `arena-result-continue-button` / `arena-result-return-button` | CTA |

## Growth

| testid | 위치 |
|--------|------|
| `growth-page` | Growth 허브 section |
| `growth-journey-card` | Journey 카드 링크 |
| `growth-dojo-card` / `growth-integrity-card` / `growth-guidance-card` | 동일 |

## My Page

| testid | 용도 |
|--------|------|
| `my-page-overview` | 개요 region |
| `my-page-identity-card` / `progress-card` / `team-card` | 카드 |
| `my-page-code-name` / `stage` / `core-progress` / `weekly-progress` / `tii-summary` | 필드 |
| `my-page-progress-screen` / `core-xp` / `weekly-xp` / `streak` / `system-note` | Progress |
| `my-page-team-screen` / `tii` / `team-status` / `team-trend` / `team-rank` | Team |
| `my-page-leader-screen` / `leader-status` / `leader-readiness` / `certification` | Leader |

## Modal 공통

`Modal`에 `panelDataTestId`로 패널에 testid 부착 가능.

## CI (Journey / Comeback)

- GitHub Actions E2E job에는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** 가 필요합니다. Journey `/api/journey/profile`가 admin 클라이언트로 `bty_profiles`를 읽습니다.
- `@comeback-journey` 테스트 전에 `npm run e2e:seed-comeback`이 `E2E_COMEBACK_EMAIL` 사용자의 `bty_profiles`를 **5일 전 타임스탬프**로 upsert해 `is_comeback_eligible`이 true가 되게 합니다. (모달은 3일+ 미접촉 규칙을 따름.)
- Comeback 플로우는 첫 실행에서 Resume 시 `updated_at`이 갱신되므로 **재시도 시 모달이 안 뜰 수 있어** `chromium-comeback` 프로젝트와 해당 describe에서 `retries: 0`입니다.
