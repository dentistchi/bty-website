# BTY 오늘 서류 → 7 Cursor 핸드오프

목적: 오늘 작성한 UX·구현 서류를 **Commander + C1~C7**이 나눠 감당할 때, **중복·충돌 없이** 한 방향으로 진행한다.

---

## 1. 문서 묶음

### A. 방향·와이어 (제품/디자인 기준)

- `docs/BTY_PRODUCT_DIRECTION_PROMPTS.md` — 철학, 3탑메뉴, 시스템 규칙, 톤 프롬프트
- `docs/BTY_PIXEL_WIREFRAMES.md` — 화면별 카피·구조, React 와이어 참고 §11

### B. 구현 척추 (엔지니어링 순서)

- `docs/BTY_PAGE_SPLIT_AND_THEME_PROMPT.md` — **페이지 먼저 → 색 나중** + Cursor 대형 프롬프트
- `docs/BTY_PAGE_SPLIT_IMPLEMENTATION_PLAN.md` — Phase 1~5, 파일별 책임
- `docs/BTY_COMPONENT_PROPS_SPEC.md` — ScreenShell / Buttons / Card / Tab / BottomNav
- `docs/BTY_TAILWIND_THEME_TOKENS.md` — 토큰·Tailwind 매핑

### C. 목차

- `docs/BTY_ARENA_UX_DOC_INDEX.md` — 위 문서 링크 모음

---

## 2. 권장 역할 분담 (7 Cursor + Commander)

| 역할 | 담당 서류 | 할 일 (요약) |
|------|-----------|----------------|
| **C1 Commander** | A 전부 + B | CURSOR_TASK_BOARD·SPRINT_PLAN에 TASK 쪼개기, 순서 고정(페이지→토큰), BLOCKER만 올림 |
| **C5 UI** | A + B | `bty-arena`·`growth`·`my-page/*` 페이지 골격, `components/bty/*` 공통 UI, 와이어 카피·계층 반영 |
| **C4 API** | B (필요 시만) | 새 화면이 기존 API만 쓰면 스킵. 데이터 연동 시 route·JSDoc만 |
| **C3 Domain** | A(규칙) | UI/API에 점수 노출 규칙 위반 없는지 리뷰용. **AIR 비공개·TII 팀만** 등 |
| **C6 Test** | B | 신규 route 스모크·필요 시 컴포넌트 렌더 테스트 |
| **C2 Gatekeeper** | B | 터치 시 규칙·BTY_RELEASE_GATE_CHECK 반영 |
| **C7 Integrator** | 전체 | 배포 전 Lint/Test/Build, 화면 간 네비 스모크 |

**한 명이 “뼈대만” 잡는 게 낫다면:** C5 한 Cursor가 **Phase 1 라우트 빈 페이지 + ScreenShell + BottomNav 뼈대만** PR → 나머지 C5/C6가 채움. (Commander가 TASK로 고정.)

---

## 3. 실행 순서 (고정)

1. **Phase 1** — `BTY_PAGE_SPLIT_IMPLEMENTATION_PLAN.md` §1 라우트 분리  
2. **Phase 2** — 공통 컴포넌트 (`BTY_COMPONENT_PROPS_SPEC.md`)  
3. **Phase 3** — `BTY_TAILWIND_THEME_TOKENS.md` 적용  
4. **Phase 4** — 네비·탭 연결  
5. **Phase 5** — 폴리시 (간격·타이포)

색을 Phase 3 이전에 넣지 않는다. (`BTY_PAGE_SPLIT_AND_THEME_PROMPT.md`)

---

## 4. Commander용 복붙 한 줄

```
오늘 서류: docs/BTY_ARENA_UX_DOC_INDEX.md 참고.
순서: 페이지 분리 → 공통 컴포넌트 → 테마 토큰.
C5: 라우트+UI 뼈대, C6: 스모크, C4/C3: 필요 시만.
```

---

## 5. 제외·주의

- 제품 철학 문서(A)는 **구현 세부를 바꾸지 않고** 화면 우선순위·카피·숨김 규칙에만 쓴다.
- `growth`·`my-page` 등 **신규 경로**는 i18n·레이아웃과 충돌 없게 Commander가 한 번에 할당한다.

---

## 6. Phase 1 코드 뼈대 (C5 전용 · 단일 Cursor)

**담당:** 한 Cursor만 수정 (충돌 방지). 이후 다른 C5가 채움.

| 경로 | 역할 |
|------|------|
| `bty-app/src/components/bty/layout/ScreenShell.tsx` | 공통 화면 래퍼 |
| `/[locale]/bty-arena/wireframe` | Arena 첫 화면 **스텁** (라이브 플레이는 **`/[locale]/bty-arena` 루트 유지**) |
| `/[locale]/bty-arena/result` | Result 스텁 |
| `/[locale]/growth` | Growth main 스텁 |
| `/[locale]/my-page` | Overview 스텁 |
| `/[locale]/my-page/progress` | Progress 탭 스텁 |
| `/[locale]/my-page/team` | Team 탭 스텁 |
| `/[locale]/my-page/leader` | Leader Track 스텁 |

**중요:** `bty-arena/page.tsx`(실제 Arena 플레이)는 Phase 1에서 **교체하지 않음**. 나중에 루트를 새 IA로 옮길 때 Commander가 컷오버 TASK로 지정.

---

## 7. Commander 통지문 (Phase 1 고정 · 전 Cursor 복붙)

아래는 **확정 안내**다. 모든 Cursor·Commander가 동일 기준을 쓴다.

```
Phase 1 뼈대는 이미 한 Cursor로 반영됨. 수정 금지 구역: bty-arena/page.tsx(루트 플레이).
Arena 첫 화면 스텁: /[locale]/bty-arena/wireframe. 이후 C5는 §6 이하 파일만 채움.
```

**C5 이후 작업 범위 (§6 이하):**

- `bty-app/src/components/bty/layout/ScreenShell.tsx` 및 동일 트리에 추가하는 `components/bty/ui/*`, `components/bty/navigation/*`
- `bty-app/src/app/[locale]/bty-arena/wireframe/page.tsx`
- `bty-app/src/app/[locale]/bty-arena/result/page.tsx`
- `bty-app/src/app/[locale]/growth/page.tsx`
- `bty-app/src/app/[locale]/my-page/**/page.tsx`

**금지:** `bty-app/src/app/[locale]/bty-arena/page.tsx` (루트 Arena 플레이) 임의 리팩터·교체 — 컷오버는 Commander TASK로만.
