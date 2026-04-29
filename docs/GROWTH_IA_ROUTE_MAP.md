# Growth · Journey · Arena — Route map (C5 IA lock)

## Principles

- **Journey** lives only under **Growth** (`/growth/journey`, `/growth/journey/day/[1–28]`). Not top-level nav, not on Arena first screen.
- Bottom hub nav: **Arena | Growth | My Page** — Journey is a **sub-destination** under Growth.

## Locked routes

| Area | Path |
|------|------|
| Arena hub | `/[locale]/bty-arena` |
| Arena play (시뮬 본편) | `/[locale]/bty-arena/play` |
| Arena result | `/[locale]/bty-arena/result` |
| Growth hub | `/[locale]/growth` |
| Growth → Dojo (alias) | `/[locale]/growth/dojo` → redirects to `/[locale]/bty/dojo` |
| Growth → Integrity | `/[locale]/growth/integrity` → `/[locale]/bty/integrity` |
| Growth → Guidance | `/[locale]/growth/guidance` → `/[locale]/bty/mentor` |
| Growth → Journey | `/[locale]/growth/journey` |
| Journey day step | `/[locale]/growth/journey/day/[day]` |
| My Page | `/[locale]/my-page` |
| My Page · Progress | `/[locale]/my-page/progress` |
| My Page · Team | `/[locale]/my-page/team` |
| My Page · Leader | `/[locale]/my-page/leader` |

**CTA:** Bottom nav / Arena 탭 → **hub** (`/bty-arena`). 대시보드·랜딩·리더보드 빈 상태 등 **바로 플레이** → **`/bty-arena/play`**.

허브 버튼·금지 사항: **`docs/ARENA_HUB_CTA_POLICY.md`**. E2E 운영 v1: **`docs/BTY_E2E_OPERATIONS_V1.md`** · 스펙 목록: **`docs/E2E_ARENA.md`**.

My Page 네 화면은 **`ScreenShell` + `BottomNav`** + 상단 **`BtyMyPageTabs`**(Overview / Progress / Team / Leader / Account 스텁). Overview는 Identity·Progress·Team 3카드 + 계정 링크(Foundry dashboard).

## Growth hub cards (order)

1. Dojo  
2. Integrity Mirror  
3. Guidance  
4. Journey — *Continue your 28-day recovery path* (EN)

## Shared shell (BTY hub)

- **`ScreenShell`** (`components/bty/layout/ScreenShell.tsx`) — full-page frame: `#F6F4EE`, optional eyebrow/title/subtitle, `BottomNav`.
- **`CardScreenShell`** — 카드형 헤더+본문 (Arena 와이어·My Page 스텁).
- **`BottomNav`** + **`nav-items.ts`** — Arena / Growth / My Page 3탭, pathname으로 active (`/growth/journey*` → Growth; `/bty/dojo|integrity|mentor` → Growth).

## Document control

- Align with `docs/JOURNEY_BOUNCEBACK_IA.md`, `docs/JOURNEY_COMEBACK_UX_SPEC.md`.
