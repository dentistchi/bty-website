# BTY AI CONTEXT LOCK

이 문서는 모든 Cursor(C1~C5)가 동일한 컨텍스트로 작업하도록 강제한다.

**모든 작업 시작 전에 반드시 이 문서를 기준으로 판단한다.**

---

## 프로젝트 구조

| 역할 | 범위 |
|------|------|
| **C1 Commander** | Plan only |
| **C2 Gatekeeper** | Rule validation, Release Gate |
| **C3 Domain/API** | Domain logic, API, middleware |
| **C4 UI** | render-only UI |
| **C5 Integrator** | lint, test, build, verify |

---

## 실행 구조

```
C1
 ↓
C2  C3  C4   (병렬 실행)
 ↓
C5   (마지막 실행)
```

- C2, C3, C4 병렬 실행
- C5 마지막 실행

---

## 도메인 원칙

1. Season progress does **NOT** affect leaderboard ranking
2. Core XP is permanent
3. Weekly XP resets weekly
4. UI never calculates XP or ranking
5. Domain logic lives only in:
   - `src/domain`
   - `src/lib/bty/arena`

---

## API 원칙

**API는 계산하지 않는다.**

**API 역할**

- request validation
- domain 호출
- response 반환

---

## UI 원칙

**UI는 항상 render-only**

**금지**

- XP 계산
- ranking 계산
- season logic

**허용**

- formatNumber
- formatDate

---

## 인증 원칙

쿠키 변경 시 반드시 **bty-auth-deploy-safety** 준수.

**파일**

- `src/lib/bty/cookies/authCookies.ts`
- `src/middleware.ts`

---

## Release Gate

다음 변경 시 반드시 Gate 검사:

- Auth
- Cookie
- Leaderboard
- XP
- Season
- Migration

---

## 작업 규칙

| 역할 | 책임 |
|------|------|
| **C1** | 코드 수정 금지 |
| **C2** | Gate 검사 |
| **C3** | 도메인/API 수정 |
| **C4** | UI 수정 |
| **C5** | lint, test, build |

---

## 출력 규칙

Commander 출력은 항상 동일 형식:

- First Task
- Start Exit Table
- C2 Command
- C3 Command
- C4 Command
- C5 Command
- Verify Command

---

## 병렬 원칙

**C2 · C3 · C4** — 항상 병렬 실행

---

## 검증 명령

```bash
npm run lint && npm test && npm run build
```

---

*모든 Cursor는 이 문서를 기준으로 작업한다.*
