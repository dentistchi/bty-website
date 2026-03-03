# BTY Arena – Chromatic / Visual Regression 전략 (문서)

## 목표

- **Storybook 기반**으로 UI 회귀를 조기에 잡는다.
- **토큰 / 테마 / i18n / 모션 / 반응형** 축에서 깨짐을 자동 검출한다.
- 모든 스토리를 무작정 돌리지 않고 **핵심 스냅샷 세트**를 고정한다.

**관련**: `BTY_ARENA_COMPONENT_INVENTORY_STORYBOOK.md`, `.storybook/preview.ts` (globals)

---

## 전제 (현재 프로젝트 패턴)

- **Storybook globals**  
  - mode: light / dark  
  - domain: arena / foundry / center / neutral  
  - locale: ko / en  
  - reducedMotion: true / false  
- 컴포넌트는 **토큰 기반** (Tailwind + css-vars)으로 렌더링.

---

## 캡처 단위 (2 레이어)

### A) Component Level (기본)

- **ui/Button**, **ui/EmptyState**, **ui/ErrorState**, **ui/Card**, **ui/ProgressRing** 등.
- 상태(Loading / Empty / Error / Disabled) 중심.

### B) Screen Level (추가, 화면이 늘면)

- 15 화면 중 **핵심 5~7개**를 “대표 화면 스토리”로 캡처.
  - ArenaHome, ArenaSimulation, ArenaResult  
  - FoundryHome, FoundryInsightCards  
  - CenterEntry, SafeMirror, CenterMiniRecovery  

---

## “스냅샷 매트릭스” 정책 (폭발 방지)

- **전 조합(4축 전부)** = 비용 과다.
- **기본 정책**  
  1) UI Atomic은 **“대표 조합 2~4개”**만 캡처.  
  2) 화면 스토리는 **“light/dark + ko/en + reducedMotion 1개”** 정도로 제한.

### 권장 매트릭스 (기본)

**Atomic**

- (light, ko, domain=해당 tone, reducedMotion=false)
- (dark, ko, domain=해당 tone, reducedMotion=false)
- (light, en, domain=해당 tone, reducedMotion=false) — 텍스트 줄바꿈 이슈 잡기
- (light, ko, domain=해당 tone, reducedMotion=true) — 모션 의존 UI 방지

**Screen**

- (light, ko, domain=해당 화면 tone, reducedMotion=false)
- (dark, ko, domain=해당 화면 tone, reducedMotion=false)
- (light, en, domain=해당 화면 tone, reducedMotion=false)

---

## Viewport 정책 (반응형 회귀)

- **모바일 / 데스크탑 2개만** 고정 (초기).  
  - **Mobile**: 390×844  
  - **Desktop**: 1440×900  
- **Tablet**은 레이아웃 이슈가 자주 터질 때만 추가: **768×1024**.

---

## 스토리 작성 규칙 (Chromatic 친화)

- **랜덤 / 시간 / 애니메이션**을 스냅샷에서 제거.  
  - `Date.now`, `Math.random` 사용 금지 (또는 mock).  
  - Progress animation은 reducedMotion에서 비활성.
- **네트워크 의존 금지.**  
  - Story는 **fixture / mock props** 기반.
- **텍스트**는 **i18n key 기반(t())** 으로만 노출.

---

## 승인(Review) 정책

- **토큰 / 타이포 / 컬러 변경 PR**  
  - UI 전체가 흔들릴 수 있음 → **디자인 승인자 1명 + FE 1명** 리뷰 고정.
- **기능 PR**  
  - 해당 **컴포넌트 / 화면만** 승인 범위를 제한.

---

## 실패 / 플레이북

깨짐이 발생하면 **우선순위**:

1. **토큰 / 글로벌 스타일** 변화인지 확인 (globals.css, css-vars).
2. **locale(en)** 에서 줄바꿈 / 레이아웃 변화인지 확인.
3. **다크모드** 대비 / 가독성 문제인지 확인.
4. **reducedMotion** 에서 상태 표현이 사라졌는지 확인.

---

## 단계별 롤아웃 (추천)

### Phase 1 (지금)

- **UI Atomic 8~12개**만 Chromatic 등록.
- viewport **2개** (Mobile, Desktop).
- 매트릭스 **최소** (위 Atomic 기본 3~4).

### Phase 2 (화면 스토리 생기면)

- **대표 화면 5~7개** 추가.
- **en** 캡처 확대 (문구 길이 문제).

### Phase 3 (리그/리더보드/그래프 복잡해지면)

- **그래프/차트**는 **고정 데이터 fixture**로만 캡처.
- **미세 애니메이션**은 reducedMotion에서 제거.

---

## Done Definition (문서 기준)

- PR마다 **Chromatic 체크**가 자동 실행된다.
- **핵심 Atomic 스토리 10개** + **화면 스토리 5개 이상**이 안정적으로 캡처된다.
- **light/dark + ko/en** 최소 조합에서 **레이아웃 회귀**를 잡는다.

---

**문서 위치**: `bty-app/docs/BTY_ARENA_CHROMATIC_VISUAL_REGRESSION_STRATEGY.md`  
**참조**: `BTY_ARENA_COMPONENT_INVENTORY_STORYBOOK.md`, `.storybook/preview.ts`, `BTY_ARENA_VISUAL_TOC.md` (15 화면)
