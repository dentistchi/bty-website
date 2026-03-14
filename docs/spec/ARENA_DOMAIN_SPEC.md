# Arena Domain Spec

> 단일 참조 문서. **갱신: 2026-03-09** (SPRINT 14 작성 → 18 동기화).

**관련 스펙**: [Foundry Domain Spec](./FOUNDRY_DOMAIN_SPEC.md) — Dojo·Integrity·Mentor·시나리오 콘텐츠는 Foundry. 시나리오 50개·Leadership Engine·Elite 정의는 Foundry 스펙과 동기화.

---

## 1. 시스템 범위

Arena는 **경쟁·성장 시스템**이다. 시나리오 기반 리더십 훈련에서 XP를 획득하고, 주간 리더보드에서 경쟁하며, Core XP를 통해 영구적 성장을 기록한다.

| 하위 시스템 | 설명 |
|---|---|
| **XP Engine** | Weekly XP (경쟁용, 주간 리셋) + Core XP (영구 성장, 절대 감소 안 됨) |
| **Level / Tier / Code** | Core XP → Tier → Code(FORGE~CODELESS ZONE) → Sub Name 매핑 |
| **Leaderboard** | Weekly XP 기준 순위. Season/Core XP는 순위에 영향 없음 |
| **Season** | 시즌 경계·carryover·weekly reset |
| **Elite** | 주간 상위 5% — 배지·멘토 신청·특별 시나리오 |
| **Scenario Engine** | 리더십 시나리오 선택·XP 계산·히든 스탯 |
| **Beginner Flow** | 7-step 초보자 성찰 시나리오 |
| **Reflection Engine** | 패턴 감지·성찰 메시지 생성 (ko/en) |
| **Avatar** | 캐릭터·의상·악세사리 레이어 합성 |
| **Leadership Engine** | Stage 전이·AIR·TII·LRI·Certified·Forced Reset |

### 경로 규칙

| 계층 | 경로 |
|---|---|
| Domain | `src/domain/rules/`, `src/domain/constants.ts`, `src/domain/types.ts` |
| Service | `src/lib/bty/arena/` |
| API | `src/app/api/arena/` |
| UI | `src/app/[locale]/bty-arena/`, `src/components/bty-arena/` |

---

## 2. 도메인 모듈 목록 (`src/domain/rules/`)

### 2-1. `xp.ts` — XP 변환 규칙

| 함수 | 역할 |
|---|---|
| `seasonalToCoreConversion(seasonalEarned, currentCoreXp)` | Seasonal→Core 변환. Core<200: 45:1 / 200+: 60:1. 소수점 buffer 반환 |

### 2-2. `level-tier.ts` — Level / Tier / Code 매핑

| 함수 | 역할 |
|---|---|
| `tierFromCoreXp(coreXp)` | `floor(coreXp / 10)` |
| `codeIndexFromTier(tier)` | `floor(tier / 100)` → 0~6 |
| `subTierGroupFromTier(tier)` | `floor((tier % 100) / 25)` → 0~3 |
| `resolveSubName(codeIndex, subTierGroup, custom)` | 커스텀 우선, 없으면 기본 Sub Name |
| `codeNameFromIndex(codeIndex)` | Code 이름 문자열 |
| `stageFromCoreXp(coreXp)` | `min(7, floor(coreXp/100)+1)` |

### 2-3. `stage.ts` — Stage 파생 상태

| 함수 | 역할 |
|---|---|
| `stageNumberFromCoreXp(coreXp)` | `min(7, floor(safe/100)+1)` |
| `defaultSubName(codeIndex, subTierGroup)` | 기본 Sub Name (null = CODELESS) |
| `stageStateFromCoreXp(coreXp, custom)` | 복합 파생: `{ tier, codeIndex, subTierGroup, stageNumber, codeName, subName }` |
| `codeIndexFromTier` | level-tier.ts와 **동일 구현** (중복) |
| `subTierGroupFromTier` | level-tier.ts와 **동일 구현** (중복) |
| `resolveSubName` | level-tier.ts와 **동일 구현** (중복) |
| `codeNameFromIndex` | level-tier.ts와 **동일 구현** (중복) |

> **Note**: `index.ts`는 stage.ts에서 `stageNumberFromCoreXp`, `defaultSubName`, `stageStateFromCoreXp` 3개만 선택 re-export하여 중복 함수 충돌을 방지.

### 2-4. `leaderboard.ts` — 리더보드 순위 규칙

| 함수 | 역할 |
|---|---|
| `rankByWeeklyXpOnly(entries)` | Weekly XP desc 정렬 + 1-based rank |
| `eliteCutoffRank(totalEntries)` | 상위 5% 컷오프 (최소 1) |
| `isElite(rank, totalEntries)` | Elite 여부 |
| `rankFromCountAbove(totalCount, countAbove)` | DB count → 1-based rank |
| `weeklyRankFromCounts(totalCount, countAbove)` | rank + isTop5Percent |

### 2-5. `leaderboardTieBreak.ts` — Tie-break 규칙

| 상수/함수 | 역할 |
|---|---|
| `LEADERBOARD_TIE_BREAK_ORDER` | `xp_total desc → updated_at asc → user_id asc` |
| `compareWeeklyXpTieBreak(a, b)` | 결정론적 tie-break 비교 |

### 2-6. `season.ts` — 시즌 생명주기

| 함수 | 역할 |
|---|---|
| `isDateWithinSeason(date, window)` | 날짜가 시즌 범위 내인지 |
| `carryoverWeeklyXp(weeklyXpTotal)` | 시즌 전환 시 이월 XP |

### 2-7. 보조 모듈

| 파일 | 역할 |
|---|---|
| `src/domain/constants.ts` | 전체 상수 (`CORE_XP_PER_TIER=10`, `TIERS_PER_CODE=100`, `ELITE_TOP_FRACTION=0.05` 등) |
| `src/domain/types.ts` | 순수 타입 (`StageState`, `LeaderboardEntryDomain`, `SeasonWindow`, `CodeIndex`, `SubTierGroup`) |

---

## 3. Domain Duplication 현황

### 3-1. 중복 표

| 함수 | `domain/rules/level-tier.ts` (Canonical) | `domain/rules/stage.ts` | `lib/bty/arena/codes.ts` | `lib/bty/arena/domain.ts` |
|---|:---:|:---:|:---:|:---:|
| `tierFromCoreXp` | ✅ | — (import 사용) | ✅ **자체 구현** | — |
| `codeIndexFromTier` | ✅ | ✅ **자체 구현** | ✅ **자체 구현** | — |
| `subTierGroupFromTier` | ✅ | ✅ **자체 구현** | ✅ **자체 구현** | — |
| `resolveSubName` | ✅ | ✅ **자체 구현** | ✅ **자체 구현** | — |
| `codeNameFromIndex` | ✅ | ✅ **자체 구현** | — | — |
| `stageFromCoreXp` | ✅ | — (`stageNumberFromCoreXp` 이름) | — | — |
| `seasonalToCoreConversion` | ✅ (`xp.ts`) | — | ✅ **자체 구현** | — |
| `awardXp` | — | — | — | ✅ **자체 구현** |
| `calculateLevel` | — | — | — | ✅ **자체 구현** |
| `calculateTier` (Weekly) | — | — | — | ✅ **자체 구현** |
| `seasonReset` | — | — | — | ✅ **자체 구현** |
| `leaderboardSort` | — | — | — | ✅ **자체 구현** |

### 3-2. Import Direction 위반 현황

| 파일 | 위반 내용 | 영향 |
|---|---|---|
| `lib/bty/arena/codes.ts` | `domain/rules`를 import하지 않고 `tierFromCoreXp`, `codeIndexFromTier`, `subTierGroupFromTier`, `resolveSubName`, `seasonalToCoreConversion`을 자체 구현 | 규칙 변경 시 2곳 수정 필요 |
| `lib/bty/arena/domain.ts` | `domain/rules`를 import하지 않고 `awardXp`, `calculateLevel`, `calculateTier`, `seasonReset`, `leaderboardSort`를 자체 구현 | Weekly XP 규칙 변경 시 2곳 수정 필요 |
| `domain/rules/stage.ts` | `level-tier.ts`의 함수를 import하지 않고 4개 함수 재구현 (`tierFromCoreXp`만 import) | 동일 계층 내 중복 |

### 3-3. 리팩터 방향

```text
[BEFORE]
domain/rules/level-tier.ts ──── canonical 함수들
domain/rules/stage.ts ────────── 4개 재구현 + 3개 고유 함수
lib/bty/arena/codes.ts ───────── 5개 재구현 + codes.ts 고유 (progressToNextTier, computeCoreXpDisplay, CODE_LORE)
lib/bty/arena/domain.ts ──────── 5개 독립 구현 (awardXp 등)

[AFTER]
domain/rules/level-tier.ts ──── canonical (기존 유지)
domain/rules/stage.ts ────────── level-tier import + 고유 3개만 유지 (stageNumberFromCoreXp, defaultSubName, stageStateFromCoreXp)
domain/rules/xp.ts ──────────── awardXp, calculateLevel, calculateTier, seasonReset 추가 (또는 별도 weekly-xp.ts)
lib/bty/arena/codes.ts ───────── domain/rules import + 고유 로직만 (progressToNextTier, computeCoreXpDisplay, CODE_LORE, CODE_NAMES, SUB_NAMES)
lib/bty/arena/domain.ts ──────── domain/rules import + re-export (또는 제거)
```

**원칙**: Domain 계층이 single source of truth. Service 계층은 domain import + 조합/DB 연동만.

---

## 4. API 엔드포인트 목록 (32개)

### 4-1. Run Lifecycle

| Method | Endpoint | 역할 |
|---|---|---|
| POST | `/api/arena/run` | 런 생성 (시나리오 배정) |
| POST | `/api/arena/run/complete` | 런 완료 (XP 지급·성찰 저장) |
| GET | `/api/arena/runs` | 런 이력 조회 |

### 4-2. Beginner Flow

| Method | Endpoint | 역할 |
|---|---|---|
| POST | `/api/arena/beginner-run` | 초보자 런 생성 |
| POST | `/api/arena/beginner-event` | 초보자 이벤트 기록 |
| POST | `/api/arena/beginner-complete` | 초보자 런 완료 |

### 4-3. XP & Stats

| Method | Endpoint | 역할 |
|---|---|---|
| GET | `/api/arena/core-xp` | Core XP + 파생 표시값 (stage, codeLore, progress) |
| GET | `/api/arena/weekly-xp` | Weekly XP 현재값 |
| GET | `/api/arena/weekly-stats` | 주간 통계 |
| GET | `/api/arena/today-xp` | 오늘 XP |

### 4-4. Leaderboard

| Method | Endpoint | 역할 |
|---|---|---|
| GET | `/api/arena/leaderboard` | 리더보드 (scope=overall/role/office) |
| GET | `/api/arena/leaderboard/status` | 내 리더보드 상태 |

### 4-5. Profile & Identity

| Method | Endpoint | 역할 |
|---|---|---|
| GET/PATCH | `/api/arena/profile` | 프로필 조회·수정 |
| GET | `/api/arena/code-name` | 코드 네임 조회 |
| PATCH | `/api/arena/sub-name` | 서브 네임 변경 |

### 4-6. Avatar

| Method | Endpoint | 역할 |
|---|---|---|
| GET/PATCH | `/api/arena/avatar` | 아바타 설정 |
| POST | `/api/arena/avatar/upload` | 아바타 이미지 업로드 |
| GET/PATCH | `/api/arena/profile/avatar` | 프로필 아바타 |

### 4-7. Scenario & Reflection

| Method | Endpoint | 역할 |
|---|---|---|
| POST | `/api/arena/event` | 시나리오 이벤트 기록 |
| POST | `/api/arena/reflect` | 성찰 제출 |
| POST | `/api/arena/free-response` | 자유 응답 |
| GET | `/api/arena/unlocked-scenarios` | 해금된 시나리오 목록 |

### 4-8. Social & Elite

| Method | Endpoint | 역할 |
|---|---|---|
| POST | `/api/arena/membership-request` | 멤버십 가입 요청 |
| GET | `/api/arena/mentor-requests` | 멘토 신청 큐 (admin) |
| PATCH | `/api/arena/mentor-requests/[id]` | 멘토 신청 승인/거절 |

### 4-9. League

| Method | Endpoint | 역할 |
|---|---|---|
| GET | `/api/arena/league/active` | 활성 리그 조회 |

### 4-10. Leadership Engine

| Method | Endpoint | 역할 |
|---|---|---|
| GET | `/api/arena/leadership-engine/state` | LE 현재 상태 |
| GET | `/api/arena/leadership-engine/air` | AIR 값 |
| GET | `/api/arena/leadership-engine/tii` | TII 값 |
| GET | `/api/arena/leadership-engine/certified` | Certified 상태 |
| POST | `/api/arena/leadership-engine/transition` | Stage 전이 실행 |

### 4-11. Combined

| Method | Endpoint | 역할 |
|---|---|---|
| GET | `/api/arena` | Arena 종합 데이터 |

---

## 5. 서비스 모듈 목록 (`src/lib/bty/arena/` — 26개)

### 5-1. Core XP / Weekly XP

| 모듈 | 역할 | Domain Import |
|---|---|---|
| `domain.ts` | awardXp, calculateLevel/Tier, seasonReset, leaderboardSort | ❌ 자체 구현 |
| `codes.ts` | Code/SubName 상수, tierFromCoreXp, progressToNextTier, computeCoreXpDisplay, seasonalToCoreConversion | ❌ 자체 구현 |
| `applyCoreXp.ts` | Seasonal→Core DB 반영 (Supabase upsert) | ✅ |
| `activityXp.ts` | 활동 XP 기록 (cross-system) | — |

### 5-2. Leaderboard

| 모듈 | 역할 | Domain Import |
|---|---|---|
| `leaderboardTieBreak.ts` | Tie-break 규칙 | ✅ `@/domain/rules/leaderboardTieBreak` |
| `leaderboardScope.ts` | scope=role/office 파싱·라벨 | — |
| `leaderboardWeekBoundary.ts` | 주간 경계 계산 | — |

### 5-3. Scenario & Reflection

| 모듈 | 역할 |
|---|---|
| `engine.ts` | computeXp, pickSystemMessageId, evaluateChoice, evaluateFollowUp |
| `reflection-engine.ts` | 패턴 감지 (defensive, blame, rushed, control), 성찰 메시지 생성 (ko/en) |
| `withArenaReflection.ts` | API route 래퍼 — 성찰 병합 |

### 5-4. User & Profile

| 모듈 | 역할 |
|---|---|
| `profileDisplayName.ts` | 표시 이름 검증 (validateDisplayName, 최대 64자) |
| `milestone.ts` | Tier 마일스톤 감지 + **localStorage 직접 사용** (사이드 이펙트 위반) |
| `mentorRequest.ts` | Elite 멘토 신청 — canRequestMentorSession, validateMentorRequestPayload, canTransitionStatus |
| `notifyMembershipRequest.ts` | 멤버십 요청 알림 |

### 5-5. Content Unlock

| 모듈 | 역할 |
|---|---|
| `tenure.ts` | 재직 기간 기반 레벨 해금 (isNewJoinerTenure, getNextLockedLevel) |
| `unlock.ts` | 콘텐츠 해금 (buildTenurePolicyConfig, getUnlockedContentWindow) |
| `eliteUnlock.ts` | Elite 전용 콘텐츠 해금 (canAccessEliteOnlyContent) |
| `program.ts` | Track/jobFunction 해결 |

### 5-6. Elite

| 모듈 | 역할 |
|---|---|
| `eliteStatus.ts` | getIsEliteTop5 (DB 조회) |
| `eliteBadge.ts` | 배지 증정 (getEliteBadgeGrants) |

### 5-7. Avatar

| 모듈 | 역할 |
|---|---|
| `avatarCharacters.ts` | 캐릭터 카탈로그 |
| `avatarOutfits.ts` | 의상 카탈로그·레벨별 해금 |
| `avatarAssets.ts` | 에셋 URL 해결 |

### 5-8. League

| 모듈 | 역할 |
|---|---|
| `activeLeague.ts` | 활성 리그 윈도우 관리 |

### 5-9. Weekly

| 모듈 | 역할 |
|---|---|
| `weeklyQuest.ts` | 성찰 퀘스트 보너스 (getWeekStartUTC) |

### 5-10. Infra

| 모듈 | 역할 |
|---|---|
| `supabaseServer.ts` | Supabase 서버 클라이언트 팩토리 |

---

## 6. 비즈니스 규칙 요약

| # | 규칙 | 소스 |
|---|---|---|
| 1 | **Core XP는 영구적** — 절대 감소하지 않음 | `domain/rules/xp.ts`, `lib/bty/arena/domain.ts` |
| 2 | **Weekly XP는 주간 리셋** — 주간 랭킹 전용 | `domain/rules/season.ts`, `lib/bty/arena/domain.ts` |
| 3 | **리더보드는 Weekly XP만** — Season/Core XP는 순위에 영향 없음 | `domain/rules/leaderboard.ts` |
| 4 | **Seasonal→Core 변환**: Core<200: 45:1, 200+: 60:1 | `domain/rules/xp.ts` |
| 5 | **Elite = 주간 상위 5%** — `ceil(total * 0.05)` | `domain/rules/leaderboard.ts` |
| 6 | **Tie-break**: `xp_total desc → updated_at asc → user_id asc` | `domain/rules/leaderboardTieBreak.ts` |
| 7 | **Tier = floor(coreXp / 10)**, Code = 100 tier 단위, SubTier = 25 단위 | `domain/rules/level-tier.ts` |
| 8 | **Season carryover**: `floor(weeklyXp * FRACTION)` | `domain/rules/season.ts` |
| 9 | **UI는 domain 규칙을 직접 구현하지 않음** — API 결과만 렌더 | 아키텍처 규칙 |
| 10 | **API handler는 thin** — validation → service/domain 호출 → response | 아키텍처 규칙 |

---

## 7. 알려진 아키텍처 이슈

| # | 이슈 | 우선순위 | 리팩터 방향 |
|---|---|---|---|
| 1 | `codes.ts` 5개 함수 자체 구현 (domain import 미사용) | High | `@/domain/rules` import + 고유 로직만 유지 |
| 2 | `domain.ts` 5개 함수 자체 구현 | High | awardXp 등을 `domain/rules`로 이동, domain.ts는 re-export |
| 3 | `stage.ts` ↔ `level-tier.ts` 4개 함수 중복 | Medium | stage.ts는 고유 3개만, 나머지는 level-tier import |
| 4 | `page.tsx` 1195줄 모놀리스 | Medium | useArenaSession 훅 + Step 컴포넌트 분리 |
| 5 | `leaderboard/route.ts` 408줄 | Medium | 서비스 함수 추출 |
| 6 | `milestone.ts` localStorage 사이드 이펙트 | Low | pure 함수 + UI 훅 분리 |
| 7 | API route 테스트 0건 (32 routes) | Low | 핵심 경로 통합 테스트 추가 |

---

## 8. 테스트 현황

| 계층 | 파일 수 | 테스트 수 | 커버리지 |
|---|---|---|---|
| Domain (`domain/rules/`) | 7 source + 7 test | ~50 cases | 1:1 파일 커버리지 |
| Domain (`domain/constants`, `types`) | 2 source + 2 test | ~20 cases | 상수·타입 검증 |
| Service (`lib/bty/arena/`) | 26 source + 45 test (.test + .edges.test) | ~250 cases | 전 모듈 커버 |
| API routes | 32 routes + 0 test | 0 | ❌ 미커버 |

---

*참조: `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md`, `docs/architecture/ARCHITECTURE_MAP.md`, `docs/spec/FOUNDRY_DOMAIN_SPEC.md`*
