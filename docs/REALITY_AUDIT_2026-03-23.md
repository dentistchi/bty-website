# REALITY AUDIT — 2026-03-23

## 1. CURRENT STATE (FACT, NOT INTENT)

BTY 시스템은 구조적으로 다음 3가지 레이어에서 안정화됨:

### 1.1 Arena (Execution)
- Canonical route: `/[locale]/bty-arena`
- `useArenaSession` 기반 run/session flow 정상 동작
- `/api/arena/session/next` 기반 시나리오 선택 정상화
- stale localStorage (`btyArenaState:v1`) 문제 해결됨
- beginner redirect (`/bty-arena/beginner`) 정상 유지
- XP (Core / Weekly) 정상 반영 (dashboard 연동 확인됨)

### 1.2 Avatar System
- Source of truth: `GET /api/arena/core-xp`
- `avatarCharacterImageUrl`, `avatarOutfitImageUrl`, `currentOutfit.accessoryIds` 기준으로 UI 구성
- legacy outfit mapping → manifest 기반 (`outfit_{id}.png`)로 통일됨
- body type (`_A/_B/_C/_D`) 정상 매칭
- Dashboard / Avatar card / composite layer 일치 확인됨
- outfit asset 404 문제 해결됨 (manifest 기준으로 정렬)

### 1.3 UI System Alignment (CRITICAL COMPLETED)

다음 공통 규칙이 코드 레벨에서 적용됨:

#### Shared Layout
- `ScreenShell` → 모든 주요 페이지 적용
  - dashboard
  - arena (canonical run)
  - lab
  - profile
  - profile/avatar

#### Shared Card System
- `InfoCard` → 단일 카드 시스템으로 수렴
- `ProgressCard` → InfoCard wrapper로 정렬됨
- 카드 언어 이중화 제거됨

#### Button System
- `PrimaryButton` / `SecondaryButton` 사용으로 통일
- `bty-btn-*` 및 inline button style 제거됨 (touched pages 기준)

---

## 2. DASHBOARD STATE

### 2.1 Structure
Dashboard는 다음 3-card 구조로 정리됨:

1. Identity  
2. Progress  
3. Team  

### 2.2 Behavior
- raw metric dump 제거됨
- 상태/서사 중심 UI로 전환됨
- 상세 데이터는 sub-route로 분리됨 (my-page / arena / growth 등)

### 2.3 Edge Cases
- loading state: InfoCard 3개가 아닌 skeleton + 일부 카드
- error state: 단일 InfoCard

→ 의도된 UX 패턴 (문제 아님)

---

## 3. ARENA STATE

### 3.1 Routing
- `/bty-arena` = canonical run page
- `/bty-arena/run` → redirect
- `/play`, `/result`, `/resolve` → redirect

### 3.2 UI
- `ScreenShell` 적용
- BottomNav 중복 제거
- run shell 구조 안정화

### 3.3 Known Reality
- Arena 내부 step UI는 일부 Arena-specific 컴포넌트 유지
- (PrimaryButton 완전 통일 아님 — 의도된 범위)

---

## 4. PROFILE & AVATAR

### 4.1 Profile
- `ScreenShell + InfoCard` 구조로 정렬 완료
- 버튼 시스템 통일됨

### 4.2 Avatar Settings
- `ScreenShell` 적용
- 모든 섹션 InfoCard 정렬됨
- PrimaryButton / SecondaryButton 적용
- avatar 로직 변경 없음 (safe refactor)

### 4.3 Minor Notes (non-blocking)
- loading 시 InfoCard 없음 (LoadingFallback)
- save 버튼이 카드 외부 위치
- 일부 주석 outdated (theme toggle)

---

## 5. E2E / BUILD STATE

### 5.1 Build
- `npm run build` → PASS

### 5.2 Playwright
- 전체 suite → PASS (25/25)
- canonical Arena flow 정상
- dashboard / avatar / profile 영향 없음

### 5.3 Known Limitation
- ESLint AJV schema error (환경 문제)
- UI refactor와 무관

---

## 6. GAP ANALYSIS (REAL)

### 6.1 RESOLVED
- Scenario repetition (root cause: history write missing)
- Arena dual flow confusion (route 통합)
- Avatar 404 / mismatch
- Dashboard complexity
- UI system fragmentation

### 6.2 PARTIAL / NEXT
- Memory Engine (behavior history 기반 recall)
- Delayed Outcome Engine
- Role Mirroring content pool
- Forced Reset UX (48h lockout)
- Team Index (TII) UI integration

---

## 7. PRODUCT REALITY (IMPORTANT)

현재 상태는 다음과 같음:

> ❌ 더 이상 “개발 중인 프로토타입” 단계가 아님  
> ✅ “제품 구조가 완성된 상태”  

남은 작업은:

- 시스템 확장 (Memory / Delayed Outcome)
- 콘텐츠 확장 (Scenario pool)
- UX polish (avatar / narrative depth)

---

## 8. NEXT STEP (EXECUTION PRIORITY)

1. Memory Engine 연결
2. Delayed Outcome injection
3. Perspective Switch (role mirroring) 확장
4. Leadership Engine UI (AIR / TII / LRI) 노출 방식 정리
5. Avatar visual polish (final layer)

---

## 9. ONE-LINE SUMMARY

BTY는 이제:

> **"구조가 불안정한 시스템" → "구조가 완성된 실행 엔진"으로 전환 완료**

UI / routing / avatar / arena flow는 정렬되었고,  
이제 핵심은 **behavior engine 고도화 단계**이다.

### Memory Engine
- CHOICE_CONFIRMED → memory event insert wired
- repeated flag aggregation wired (`flag_total`, `flag_consecutive`)
- threshold queue wired (`memory_pattern_threshold`)
- first recall prompt loop is live:
  - trigger queue consume
  - recall prompt returned
  - recall log write path aligned
- delayed outcome / perspective switch consumers are not yet wired

### Memory Engine
- Live verified on a real playable user
- CHOICE_CONFIRMED → memory event insert works
- repeated flag aggregation works
- threshold trigger queue works
- recall prompt consume works
- first live recall loop is operational:
  - trigger created
  - trigger consumed
  - recall message returned
- delayed outcome / perspective switch consumers are not yet wired

### Memory Engine
- Live DB/API loop verified:
  - trigger queue creation
  - trigger consumption
  - processed status transition
  - recall log insertion
  - recall prompt payload generation
- Remaining UI verification blocker:
  - tested account was forced into `/bty-arena/beginner` via `requiresBeginnerPath: true`
  - main Arena recall banner was therefore not directly observed in-browser
- Final UI verification requires a non-beginner account with a pending `memory_pattern_threshold` trigger