# ARENA EXECUTION RULES

C1이 작업을 분해하고 실행할 때 참고하는 규칙

---

## 파일 범위

### UI
- `src/app/[locale]/bty-arena/`
- `src/components/bty-arena/`

### API
- `src/app/api/arena/`
- `src/app/api/bty-arena/`
- `src/app/api/me/` (Arena 관련: mentor-request, elite 등)

### Domain
- `src/domain/rules/` (leaderboard, leaderboardTieBreak, season, stage, xp 등)
- `src/lib/bty/arena/` (engine, scenario, reflection-engine, mentorRequest 등)

### Types / Content
- `src/types/arena.ts`
- `src/content/arena-mvp-content-pack.json`

---

## Owner 매핑

| 태그     | Owner |
|----------|--------|
| [AUTH]   | C2     |
| [API]    | C3     |
| [DOMAIN] | C3     |
| [UI]     | C4     |
| [DOCS]   | C1     |
| [VERIFY] | C5     |

---

## 실행 순서 규칙

**DOMAIN 변경 포함 작업**
- C3 → C4 → C2 → C5

**API 계약 확인 작업**
- C3 → C4 → C2 → C5

**순수 UI 작업**
- C4 → C2 → C5

**문서 작업**
- C1 단독

---

## 금지 사항

- UI에서 XP 계산
- UI에서 리더보드 정렬
- UI에서 비즈니스 규칙 구현
- API handler에 비즈니스 로직
- domain 로직을 UI로 이동
