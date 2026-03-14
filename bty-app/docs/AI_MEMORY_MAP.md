# BTY PROJECT MEMORY MAP

이 문서는 모든 Cursor가 프로젝트 구조를 이해하기 위한 지도이다.

**모든 Cursor는 작업 전에 이 문서를 기준으로 파일 위치를 판단한다.**

---

## ROOT STRUCTURE

```
bty-app/
├── .cursor/
│   └── rules/
├── docs/
├── scripts/
├── src/
├── tokens/
└── supabase/
```

---

## CORE DOCUMENTS

- `docs/AI_CONTEXT_LOCK.md`
- `docs/AI_MEMORY_MAP.md`
- `docs/COMMANDER_SHORTCUTS.md`
- `docs/AGENTS_SHARED_README.md`
- `docs/BTY_RELEASE_GATE_CHECK.md`

---

## DOMAIN LOGIC

**`src/domain/`**

여기에 있는 코드만이 다음을 **계산**한다:

- XP
- Leaderboard
- Season
- Tier

**UI에서는 절대 계산하지 않는다.**

---

## ARENA DOMAIN

**`src/lib/bty/arena/`**

- `codes.ts`
- `avatarOutfits.ts`
- `avatarCharacters.ts`
- `domain.ts`

---

## API ENTRY POINT

**`src/app/api/`**

- `auth/`
- `arena/`
- `chat/`
- `mentor/`
- `center/`

---

## AUTH SYSTEM

- `src/lib/bty/cookies/authCookies.ts`
- `src/middleware.ts`

---

## UI ROOT

**`src/app/[locale]/`**

- `center/`
- `bty/`
- `bty-arena/`
- `dear-me/`

---

## UI COMPONENTS

**`src/components/`**

- `bty-arena/`
- `ui/`
- `journey/`

---

## DOMAIN RULES

| 항목 | 규칙 |
|------|------|
| Season progress | does **NOT** affect leaderboard ranking |
| Core XP | permanent |
| Weekly XP | weekly reset |
| Leaderboard | weekly XP only |

---

## UI RULES

**UI is render-only**

**forbidden**

- XP calculation
- ranking calculation
- season logic

---

## TEST STRUCTURE

- **위치**: `src/**/*.test.ts`
- **runner**: vitest

---

## BUILD COMMAND

```bash
npm run lint
npm test
npm run build
```

---

## DEPLOY CHECK

- `scripts/verify-workers-dev.sh`

---

## CURSOR RESPONSIBILITIES

| 역할 | 책임 |
|------|------|
| **C1 Commander** | planning only |
| **C2 Gatekeeper** | rule validation |
| **C3 Domain/API** | server logic |
| **C4 UI** | frontend |
| **C5 Integrator** | lint, test, build |

---

*모든 Cursor는 이 Memory Map을 기준으로 작업한다.*
