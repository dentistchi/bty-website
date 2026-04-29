# BTY AI CODE INDEX (AUTO NAVIGATOR)

이 문서는 BTY 프로젝트에서 AI(Cursors)가 코드를 빠르게 탐색하고  
수정 범위를 정확히 판단하도록 돕는 **코드 네비게이션 시스템**이다.

**모든 Cursor는 작업 시작 전 반드시 이 문서를 참고한다.**

---

## 1. 프로젝트 루트 구조

```
bty-app/
├── src/
│   ├── app/
│   ├── components/
│   ├── domain/
│   ├── lib/
│   ├── hooks/
│   └── types/
├── docs/
├── scripts/
├── tokens/
└── supabase/
```

---

## 2. 핵심 코드 영역 (AI가 가장 먼저 탐색해야 하는 위치)

### DOMAIN (비즈니스 로직)

**`src/domain/`**

| 항목 | 내용 |
|------|------|
| **역할** | XP 계산, 리더보드 규칙, 티어 시스템, 리더십 엔진 |
| **주의** | UI 또는 API에서 직접 계산 금지. 항상 domain 함수 호출. |
| **관련 파일** | `src/domain/leadership-engine/`, `src/lib/bty/arena/domain.ts` |

---

### ARENA CORE

**`src/lib/bty/arena/`**

**주요 파일**: `codes.ts`, `avatarCharacters.ts`, `avatarOutfits.ts`, `domain.ts`

**역할**: Code name, Avatar logic, Tier mapping, Arena constants

---

### AUTH SYSTEM

- `src/lib/bty/cookies/`
- `src/lib/auth/`
- `src/middleware.ts`

**역할**: 쿠키 생성, 세션 관리, 로그인 리다이렉트

**주의**: 쿠키 플래그 변경 금지 (Secure, SameSite, Domain, Path).  
변경 시 반드시 **bty-auth-deploy-safety.mdc** 검사.

---

### API LAYER

**`src/app/api/`**

**주요 API**: `auth/login`, `auth/callback`, `auth/session`, `arena/profile`, `arena/core-xp`, `arena/leaderboard`, `chat/`, `mentor/`, `center/`

**원칙**: API는 계산하지 않는다. Domain 호출만 한다.

---

### UI LAYER

- `src/components/`
- `src/app/[locale]/`

**UI 규칙**: XP 계산 금지, 리더보드 정렬 금지, 티어 계산 금지. **UI는 API 값만 렌더한다.**

---

## 3. 중요 규칙 (AI Guard System)

AI는 다음 규칙을 항상 지켜야 한다.

1. UI는 계산하지 않는다
2. XP 계산은 domain에서만 한다
3. API는 domain 호출만 한다
4. middleware는 auth만 처리한다
5. leaderboard 정렬은 weekly_xp만 사용
6. core_xp는 절대 감소하지 않는다

---

## 4. 파일 수정 우선순위

AI가 코드를 수정할 때 반드시 아래 순서를 따른다.

1. domain  
2. API  
3. UI  
4. docs  

---

## 5. 작업 유형별 수정 위치

| 유형 | 위치 |
|------|------|
| **XP / Leaderboard** | `src/domain/`, `src/lib/bty/arena/` |
| **Auth / Login / Redirect** | `src/middleware.ts`, `src/lib/bty/cookies/`, `src/app/api/auth/` |
| **Arena 로직** | `src/lib/bty/arena/` |
| **UI** | `src/components/`, `src/app/` |
| **Chatbot** | `src/app/api/chat/`, `src/lib/bty/chat/` |
| **Mentor** | `src/app/api/mentor/`, `src/lib/bty/mentor/` |
| **Center** | `src/app/api/center/`, `src/app/[locale]/center/` |

---

## 6. AI 작업 안전 가이드

AI는 다음 상황에서 **작업을 중단**해야 한다.

1. 쿠키 정책 변경 필요  
2. DB 스키마 변경 필요  
3. 리더보드 계산 로직 변경  
4. weekly reset 변경  

이 경우 반드시 **Release Gate 검사를 먼저 실행**한다.

---

## 7. Release Gate 연결

AI가 아래 파일을 수정하면 **반드시 Gate를 실행**한다.

- `src/middleware.ts`
- `src/lib/bty/cookies/`
- `src/app/api/auth/`

**검사 규칙**: `.cursor/rules/bty-release-gate.mdc`

---

## 8. 테스트 위치

- **tests**: `src/**/*.test.ts`
- **예시**: `app/api/chat/route.test.ts`, `app/api/mentor/route.test.ts`

---

## 9. 빌드 / 검증 명령

| 명령 | 실행 |
|------|------|
| lint | `npm run lint` |
| test | `npm test` |
| build | `npm run build` |
| **통합 실행** | `./scripts/self-healing-ci.sh` |

---

## 10. AI 탐색 순서

Cursor는 작업을 시작할 때 항상 아래 순서를 따른다.

1. `docs/AI_PROJECT_INDEX.md`
2. `docs/AI_CONTEXT_LOCK.md`
3. `docs/AI_MEMORY_MAP.md`
4. `docs/AI_CODE_INDEX.md`
5. `docs/AI_TASK_BOARD.md`

---

## 11. AI 자동 탐색 규칙

AI는 코드를 수정하기 전에 반드시 다음 순서로 탐색한다.

1. 관련 domain 찾기  
2. 관련 API 찾기  
3. 관련 UI 찾기  

---

## 12. 절대 수정하면 안 되는 영역

다음 코드는 매우 민감하다. **AI는 변경을 최소화**해야 한다.

- `src/middleware.ts`
- `src/lib/bty/cookies/authCookies.ts`
- `src/domain/`

---

## 13. AI 자동 복구 루프

빌드 실패 시 **lint → test → build** 순서로 반복 실행한다.

**스크립트**: `scripts/self-healing-ci.sh`

---

## 14. AI 멀티 Cursor 협업 구조

| 역할 | 책임 |
|------|------|
| **Commander** | 계획 |
| **C2** | Gatekeeper |
| **C3** | Domain/API |
| **C4** | UI |
| **C5** | Integrator |

---

## 15. 작업 흐름

```
Commander
    ↓
C2 / C3 / C4 병렬
    ↓
C5 검증
```

---

# END OF FILE
