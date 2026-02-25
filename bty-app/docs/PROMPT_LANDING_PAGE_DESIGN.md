# 랜딩 페이지 디자인 요청용 프롬프트 (ChatGPT / Gemini)

다른 AI에게 랜딩 페이지 **디자인/개선안**을 요청할 때 아래 프롬프트를 복사해 붙여넣으세요.  
(이미 구현된 랜딩이 있으므로, “디자인 아이디어” 또는 “개선 제안”을 받을 때 유용합니다.)

---

## 프롬프트 (영문)

```
You are helping design a single landing page for a web app called "Better Than Yesterday" (bty). The app has three areas; the landing page must let the user choose one.

**Tech stack:** Next.js (App Router), React, Tailwind CSS. Locale: `en` and `ko` (path prefix `/en`, `/ko`).

**Current behavior:**
- Root `/` redirects to `/en`. Routes: `/en`, `/ko` = landing; `/en/bty-arena`, `/ko/bty-arena` = Arena; `/en/bty`, `/ko/bty` = Dojo; `/en/dear-me`, `/ko/dear-me` = Dear Me.
- The landing page shows:
  1. A hero: title "Better Than Yesterday", subtitle "Where would you like to go today?" (or Korean equivalent).
  2. Three cards/buttons:
     - **Arena** (primary, most emphasized): "Play scenarios, make choices, grow. XP, weekly quests, leaderboard." → links to `/{locale}/bty-arena`.
     - **Dojo**: "Dashboard, mentor, integrity practice." → links to `/{locale}/bty`.
     - **Dear Me**: "A safe space that reflects your feelings. No advice—just reflection." → links to `/{locale}/dear-me`.
- Arena should be the visual and hierarchical focus (e.g. larger card, "Recommended" badge, stronger CTA).

**What I need from you:**
- Suggest a clean, modern layout and visual hierarchy (colors, typography, spacing) that fits a calm but motivating product (self-growth + light gamification).
- Keep the same three destinations and copy; suggest only layout/visual/UX improvements.
- If you provide code, use React + Tailwind; assume the strings are passed as props (e.g. `t.heroTitle`, `t.arenaTitle`, `t.arenaDesc`, `t.arenaCta`).
- Optional: suggest a short one-line tagline that works in both EN and KO for the hero.
```

---

## 프롬프트 (한글)

```
"Better Than Yesterday"(bty)라는 웹앱의 **단일 랜딩 페이지** 디자인을 도와줘.

**기술 스택:** Next.js (App Router), React, Tailwind CSS. locale은 `en`, `ko` (경로 접두사 `/en`, `/ko`).

**현재 동작:**
- 루트 `/`는 `/en`으로 리다이렉트. `/en`, `/ko` = 랜딩; `/en/bty-arena`, `/ko/bty-arena` = Arena; `/en/bty`, `/ko/bty` = Dojo; `/en/dear-me`, `/ko/dear-me` = Dear Me.
- 랜딩에는 다음이 있음:
  1. 히어로: 제목 "Better Than Yesterday", 부제 "Where would you like to go today?" (또는 한국어 버전).
  2. 세 개 카드/버튼:
     - **Arena** (가장 강조): "시나리오 플레이, 선택과 성장. XP, 주간 퀘스트, 리더보드." → `/{locale}/bty-arena`.
     - **Dojo**: "대시보드, 멘토, 역지사지 연습." → `/{locale}/bty`.
     - **Dear Me**: "말 못 할 마음을 비추는 안전한 공간." → `/{locale}/dear-me`.
- Arena가 시각적·계층적으로 가장 눈에 띄어야 함 (큰 카드, "추천" 뱃지, 강한 CTA 등).

**요청 사항:**
- 차분하지만 동기 부여되는 톤(자기 성장 + 가벼운 게임화)에 맞는 깔끔하고 모던한 레이아웃과 시각적 계층(색, 타이포, 여백)을 제안해줘.
- 세 가지 목적지와 문구는 유지하고, 레이아웃/비주얼/UX만 개선 제안.
- 코드를 준다면 React + Tailwind로, 문구는 props로 받는다고 가정 (예: `t.heroTitle`, `t.arenaTitle`, `t.arenaDesc`, `t.arenaCta`).
- 선택: 히어로용 EN/KO 둘 다 쓸 수 있는 한 줄 태그라인 제안.
```

---

이 문서는 이미 구현된 랜딩(`LandingClient.tsx`, `[locale]/page.tsx`)을 기준으로 작성되었습니다.  
다른 AI가 제안한 디자인/코드를 적용할 때는 `bty-app/src/app/[locale]/LandingClient.tsx`와 `bty-app/src/lib/i18n.ts`의 `landing` 키를 참고하면 됩니다.
