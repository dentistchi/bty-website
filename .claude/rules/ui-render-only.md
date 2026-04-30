---
description: UI layer — render only, no business logic computation
paths:
  - bty-app/src/app/**/*.tsx
  - bty-app/src/components/**
---

# UI Render Only Rule

UI 계층은 **render-only** 원칙을 따른다.

## 대상

- `src/app/**`
- `src/components/**`

## 역할

- 데이터 표시
- interaction 처리
- loading / empty / error state 처리

## 금지

- 비즈니스 계산
- leaderboard 정렬 규칙
- XP 계산
- 상태 전이 판단
- 시즌/리그 경계 결정

가능하면 **데이터를 service 계층을 통해** 받는다.

---

## Examples

```typescript
// ❌ BAD — business rule in UI
function Leaderboard() {
  const tier = levelToTier(level);  // no — move to domain/engine
  const rank = items.sort((a, b) => b.weeklyXp - a.weeklyXp);  // no — ranking is domain rule
}

// ✅ GOOD — UI only consumes precomputed data
function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  return <ul>{rows.map(r => <LeaderboardRow key={r.userId} {...r} />)}</ul>;
}
```

---

## 참고

- 정렬·랭크·XP·시즌 경계 등은 API/domain에서 계산된 값을 받아서 표시만 한다.
- Props와 타입으로 API/서비스 계약을 명시하고, loading/empty/error 상태를 처리한다.

## 작업 완료 시

UI 태스크 완료 시 task completion discipline 적용 (CLAUDE.md 참조).

*참조: `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md`*
