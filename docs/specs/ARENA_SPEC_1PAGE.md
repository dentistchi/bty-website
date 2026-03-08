# ARENA SPEC 1PAGE

Arena 시스템의 공식 규칙

---

## XP 규칙

### Core XP
- 영구 누적
- 리더보드 계산에는 직접 사용하지 않음

### Weekly XP
- 주간 리더보드용
- 매주 초기화
- 랭킹 계산에 사용

---

## Season 규칙

- 시즌 진행은 리더보드 랭킹을 직접 바꾸지 않는다
- 시즌은 progression 표시 목적이다

---

## Leaderboard 규칙

랭킹 기준

1. Weekly XP
2. Tie-break 규칙 (도메인: `src/domain/rules/leaderboardTieBreak.ts` 등)
3. 가입 시점

UI는 랭킹 계산을 하지 않는다

---

## UI 규칙

UI는 반드시 다음을 따른다

- render-only
- 비즈니스 계산 금지
- 정렬 금지
- 추론 금지
- API 응답 그대로 렌더

---

## Domain 규칙

비즈니스 로직 위치

**허용**
- `src/domain/**`
- `src/lib/bty/**`

**금지**
- `src/app/**`
- `src/components/**`

---

## API 규칙

API handler 역할

1. request validation
2. domain 호출
3. response 반환

API handler에 비즈니스 로직 금지

---

## Elite Mentor Request

**API**
- `GET  /api/me/mentor-request`
- `POST /api/me/mentor-request`
- `GET   /api/arena/mentor-requests`
- `PATCH /api/arena/mentor-requests`

**권한**
- Elite 사용자만 신청 가능 (Elite = Weekly XP 상위 5% 등 도메인 규칙)
