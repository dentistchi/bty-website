# 에이전트 공통 가이드 (Commander · 진행 · 에러 체크)

이 파일을 **반드시 읽고** 작업하세요. 커맨더·진행 에이전트·에러 체크 에이전트가 공통으로 참고하는 문서입니다.

> **ENGINE_ARCHITECTURE_DIRECTIVE_PLAN 사용 시**  
> `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §4·§5 프롬프트를 해당 Cursor에 붙여 넣기 **전에** 이 파일(`docs/AGENTS_SHARED_README.md`)과 `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` 를 열어 두라고 안내한다.

- **서커(커맨더)**: 계획서만 업데이트. 진행/검증 구분은 **`docs/PLAN_WORKFLOW.md`** 참고.

- **자율 진행**: 본인이 할 수 있는 것은 사용자에게 묻지 말고, 판단 가능한 범위에서 **자체 진행**한다. 불가능하거나 결정이 필요한 경우만 질문한다.

- **작업 마친 뒤 서류 갱신**: **다른 Cursor 창에서 작업을 마치면**, 해당 작업에 맞는 서류를 **반드시 갱신**한다. (예: CURRENT_TASK.md, RUNBOOK §6-4·§6-5, WHAT_NEXT.md, 백로그/체크리스트 [x], HEALING_COACHING_SPEC_V3.md 체크리스트 등.) 그래야 다른 Cursor와 커맨더가 현재 상태를 알 수 있다.

- **파일 위치**: `bty-app/docs/AGENTS_SHARED_README.md`
- **규칙 파일(.cursor/rules/)**: 리포 루트(btytrainingcenter) 또는 bty-app 기준. 없으면 상위 폴더 확인.

---

## 1. 규칙·가드 (모두 필수)

| 경로 | 역할 |
|------|------|
| `.cursor/rules/bty-release-gate.mdc` | 배포/리셋/리더보드·XP·시즌 변경 시 체크리스트 |
| `.cursor/rules/bty-arena-global.mdc` | 시즌≠랭킹, Core XP 영구, UI는 렌더만, 도메인은 순수 함수 |
| `.cursor/rules/bty-auth-deploy-safety.mdc` | 쿠키·세션·런타임 변경 시 안전 절차 |
| `.cursor/rules/bty-ui-render-only.mdc` | UI는 XP/리더보드/시즌 계산 금지, API 값만 표시 |

- **진행**: 위 규칙을 위반하지 않도록 수정.
- **에러 체크**: 변경된 코드가 위 규칙을 지키는지 검사.

---

## 2. 도메인·비즈니스 로직 (단일 소스, 여기만 수정)

| 경로 | 역할 |
|------|------|
| `src/domain/` | 레벨·티어·리더보드 등 도메인 규칙 |
| `src/lib/bty/arena/codes.ts` | 코드명·티어·서브네임 |
| `src/lib/bty/arena/avatarOutfits.ts` | 아웃핏 테마, 레벨→옷, resolveDisplayAvatarUrl |
| `src/lib/bty/arena/avatarCharacters.ts` | 캐릭터 목록·검증 |
| `src/lib/bty/arena/domain.ts` | Arena 도메인 타입·상수 |

- **진행**: XP/시즌/리더보드/아바타 규칙은 여기만 추가·수정.
- **에러 체크**: UI나 API에서 위 로직을 중복 구현했는지 확인.

---

## 3. API (계약·진입로)

| 경로 | 역할 |
|------|------|
| `src/app/api/auth/login/route.ts` | 로그인 (쿠키·세션) |
| `src/app/api/auth/callback/route.ts` | OAuth 콜백 |
| `src/app/api/arena/profile/route.ts` | 프로필·아바타 PATCH/GET |
| `src/app/api/arena/core-xp/route.ts` | Core XP·아바타 URL 계산 |
| `src/app/api/arena/leaderboard/route.ts` | 주간 XP 기준 랭킹·아바타 URL |

- **진행**: 새 API 추가·수정 시 위 규칙·도메인 참고.
- **에러 체크**: 응답 형식, 인증(401), XP/랭킹 규칙 위반 여부 확인.

---

## 4. 인증·쿠키 (한 군데만 수정)

| 경로 | 역할 |
|------|------|
| `src/lib/bty/cookies/authCookies.ts` | Supabase 쿠키 쓰기/삭제 |
| `src/middleware.ts` | 세션·리다이렉트 |

- **진행**: 로그인/로그아웃/도메인 변경 시 여기와 연동되는지 확인.
- **에러 체크**: 쿠키·도메인 변경 시 bty-auth-deploy-safety 규칙 검사.

---

## 5. UI (렌더만, 계산 금지)

| 경로 | 역할 |
|------|------|
| `src/app/[locale]/bty/(protected)/dashboard/page.client.tsx` | 대시보드·아바타 설정 |
| `src/app/[locale]/bty/leaderboard/page.tsx` | 리더보드 페이지 |
| `src/components/bty-arena/LeaderboardRow.tsx` | 리더보드 행 (API 값만 표시) |
| `src/components/bty-arena/UserAvatar.tsx` | 아바타 표시 |

- **진행**: XP/랭킹/시즌/아바타 계산 넣지 말고, API에서 받은 값만 표시.
- **에러 체크**: tierFromCoreXp, sort 같은 비즈니스 로직이 컴포넌트에 있는지 확인.

---

## 6. DB·환경

| 경로 | 역할 |
|------|------|
| `supabase/migrations/` | 스키마·RLS 변경 |
| `.env.example` | 필요한 env 변수 목록 (실제 값은 .env.local) |

- **진행**: 마이그레이션 추가 시 bty-release-gate의 "Data / Migration Safety" 절 충족.
- **에러 체크**: 새 마이그레이션이 Core XP / Weekly XP 분리 등을 깨지 않는지 확인.

---

## 7. 역할별 상세 지정

**→ `docs/AGENTS_ROLES.md`** 에서 **진행 에이전트** / **에러 체크 에이전트** 역할을 확인하세요.

- **커맨더**: 위 규칙·도메인·API·auth를 기준으로 작업 지시·우선순위 정함.
- **진행 에이전트**: `AGENTS_ROLES.md` §1 참고. `src/domain/`, `src/lib/bty/arena/`, `src/app/api/` 중심 수정. UI는 API 결과만 렌더.
- **에러 체크 에이전트**: `AGENTS_ROLES.md` §2 참고. 변경분을 규칙·도메인·API·auth 기준으로 검사 후 보고.
