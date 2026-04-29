# Cursor Master Prompt — `data-testid` 반영 (E2E 안정화)

**목적:** Journey / Arena / Growth / My Page 핵심 플로우를 Playwright에서 문구·i18n과 무관하게 잡기.  
**잠긴 ID 표:** [`E2E_DATA_TESTIDS.md`](./E2E_DATA_TESTIDS.md)

---

## 짧은 버전 (복사용)

```
Add stable data-testid attributes to BTY Journey / Arena / Growth / My Page components for Playwright.

Required:
- comeback-modal
- comeback-modal-title
- resume-journey-button
- journey-board
- journey-current-day
- journey-continue-button
- journey-day-step
- journey-complete-button
- arena-hub
- arena-play-button
- growth-journey-card
- my-page-overview

Also add the full BTY test id set from docs/E2E_DATA_TESTIDS.md if the matching elements already exist.

Do not change behavior. Output code only.
```

---

## 전체 버전 (복사용)

```
You are a senior frontend engineer working inside the BTY project.

Your task is to add stable `data-testid` attributes to the existing BTY UI components so Playwright E2E becomes resilient to text/i18n/copy changes.

This is a test-stability task only.
Do NOT change product behavior, routing, or layout logic.
Only add the minimum useful `data-testid` attributes.

==================================================
[Goal]
==================================================

Stabilize Playwright coverage for:
- Journey comeback flow
- Journey board / day step flow
- Arena hub
- Growth Journey entry
- My Page key status sections

==================================================
[Priority Order]
==================================================

1. Journey components
2. Arena hub
3. Growth Journey card
4. My Page key sections

==================================================
[Required test ids]
==================================================

A) Comeback modal
- comeback-modal
- comeback-modal-title
- comeback-modal-description
- resume-journey-button
- close-comeback-button

B) Journey board
- journey-board
- journey-current-day
- journey-status-text
- journey-continue-button
- journey-restart-button
- journey-day-cell-XX   // formatted 01..28

C) Restart Journey dialog
- restart-journey-dialog
- restart-journey-confirm
- restart-journey-cancel

D) Journey day step
- journey-day-step
- journey-day-title
- journey-day-body
- journey-complete-button
- journey-back-button

E) Arena hub
- arena-hub
- arena-continue-button
- arena-play-button
- arena-weekly-rank
- arena-season-ends

F) Growth
- growth-page
- growth-journey-card

G) My Page overview / status
- my-page-overview
- my-page-identity-card
- my-page-progress-card
- my-page-team-card
- my-page-code-name
- my-page-stage
- my-page-core-progress
- my-page-weekly-progress
- my-page-tii-summary

H) My Page subpages
- my-page-progress-screen
- my-page-team-screen
- my-page-leader-screen
- my-page-leader-readiness
- my-page-certification

==================================================
[Implementation Rules]
==================================================

- Add test ids only where they help E2E stability
- Do not add unnecessary or duplicate test ids everywhere
- Do not rename components unless absolutely required
- Keep code clean and minimal
- Prefer adding test ids to top-level stable elements
- For Journey day cells, use:
  data-testid={`journey-day-cell-${String(day).padStart(2, "0")}`}

==================================================
[Expected Result]
==================================================

After this change, these Playwright selectors should be reliable:

- page.getByTestId("growth-journey-card")
- page.getByTestId("comeback-modal")
- page.getByTestId("resume-journey-button")
- page.getByTestId("journey-board")
- page.getByTestId("journey-current-day")
- page.getByTestId("journey-continue-button")
- page.getByTestId("journey-day-step")
- page.getByTestId("journey-complete-button")
- page.getByTestId("arena-play-button")
- page.getByTestId("my-page-overview")

==================================================
[Files likely involved]
==================================================

Adapt conservatively to the actual repo structure, but likely files include:
- src/components/bty/journey/ComebackModal.tsx
- src/components/bty/journey/JourneyBoard.tsx
- src/components/bty/journey/RestartJourneyDialog.tsx
- src/components/bty/journey/JourneyDayStep.tsx
- src/app/[locale]/growth/page.tsx
- src/app/[locale]/bty-arena/page.tsx
- src/app/[locale]/my-page/page.tsx
- src/app/[locale]/my-page/progress/page.tsx
- src/app/[locale]/my-page/team/page.tsx
- src/app/[locale]/my-page/leader/page.tsx

==================================================
[Output]
==================================================

Output code only.
Do not explain.
Do not brainstorm.
Do not change behavior.
```

---

## 적용 직후 체크리스트

1. `e2e/journey.spec.ts` 등 스펙이 testid 기반인지 확인  
2. 로컬: `e2e:auth` → `e2e:auth:comeback`(comeback 계정 시) → `test:e2e`  
3. CI: Actions **E2E** `workflow_dispatch`
