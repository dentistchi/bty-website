# BTY Implementation Checklist v1 (실행용)

> Cursor로 그대로 따라 밀어붙이는 순서. **전략 문서가 아니라 실행 플랜.**  
> 상위 개요: [`BTY_MASTER_BUILD_V1.md`](./BTY_MASTER_BUILD_V1.md)

---

## Phase 1 — Arena 완성 (핵심 엔진)

**목표:** 유저가 실제로 플레이하고 **결과까지** 본다.

| # | 체크리스트 | 상태 |
|---|------------|------|
| 1 | `/[locale]/bty-arena` 라우트 | ✅ |
| 2 | `/[locale]/bty-arena/play` 라우트 | ✅ |
| 3 | `/[locale]/bty-arena/result` 라우트 | ✅ |
| 4 | 시나리오 / 세션 (mission storage, `useArenaSession`) 연결 | ✅ |
| 5 | `useArenaSession` 상태 연결 | ✅ |
| 6 | primary 선택 작동 | ✅ |
| 7 | reinforcement 선택 작동 | ✅ |
| 8 | Arena play UI 정상 렌더 | ✅ |
| 9 | Arena resolve UI 정상 렌더 | ✅ |
| 10 | `buildArenaSignal` 구현 | ✅ |
| 11 | signal → `localStorage` (`bty-signals`, `pushSignalIfNew` 중복 방지) | ✅ |

**완료 기준:** 플레이 → 선택 → 결과까지 **끊김 없이** 한 사이클.

**핵심 파일:** `src/app/[locale]/bty-arena/result/page.tsx`, `src/features/arena/logic/`

---

## Phase 2 — Reflection 연결 (Growth 시작)

**목표:** Arena 결과 → **질문(seed)**으로 변환 → **저장(entry)**.

| # | 체크리스트 | 상태 |
|---|------------|------|
| 1 | `buildReflectionSeed.ts` | ✅ |
| 2 | `pushReflectionSeed` / `pushReflectionSeedIfNew` → `bty-growth-seeds` | ✅ |
| 3 | `/[locale]/growth/reflection` (에어록) | ✅ |
| 4 | `/[locale]/growth/reflection/write` | ✅ |
| 5 | `getLatestReflectionSeed` / `loadLatestReflectionSeed` | ✅ |
| 6 | `ReflectionWritingScreen` — 3문항 + commitment | ✅ |
| 7 | `buildReflectionEntry` | ✅ |
| 8 | `pushReflection` → `bty-reflections` | ✅ |
| 9 | 저장 후 `/growth/history` 이동 | ✅ |

**완료 기준:** Arena 종료 후 seed가 쌓이고, 작성 저장 시 **History에 반영 가능**.

**핵심 파일:** `src/features/growth/logic/growthStorage.ts`, `reflectionStorage.ts`, `buildReflectionEntry.ts`, `src/app/[locale]/growth/reflection/write/page.tsx`

---

## Phase 3 — Growth History (누적 구조)

**목표:** Reflection이 **기록 보드**로 쌓인다.

| # | 체크리스트 | 상태 |
|---|------------|------|
| 1 | `/[locale]/growth/history` | ✅ |
| 2 | `loadReflections` | ✅ |
| 3 | `GrowthHistoryScreen` | ✅ |
| 4 | 카드: focus, prompt, commitment, 날짜 | ✅ |
| 5 | focus 요약 (최근 5, 4캡슐) | ✅ |
| 6 | empty state | ✅ |

**완료 기준:** 저장 직후 History에서 **바로** 보인다 (같은 브라우저 `localStorage`).

**핵심 파일:** `src/features/growth/history/GrowthHistoryScreen.tsx`, `src/app/[locale]/growth/history/page.tsx`

---

## Phase 4 — Recovery 시스템 (차별화)

**목표:** 압력/패턴 누적 시 **조용한 보호** + re-entry.

| # | 체크리스트 | 상태 |
|---|------------|------|
| 1 | `checkRecoveryTrigger` (Arena 최근 신호) | ✅ |
| 2 | regulation 성찰 반복 등 → `shouldShowCompoundRecovery` | ✅ |
| 3 | Growth History — Recovery strip (`recoveryTriggered`) | ✅ |
| 4 | `/[locale]/growth/recovery` | ✅ |
| 5 | `RecoveryEntryScreen` + `buildRecoveryPrompt` | ✅ |
| 6 | `pushRecoveryEntry` → `bty-recovery-entries`, 저장 후 history 등 | ✅ |

**완료 기준:** **필요할 때만** strip·recovery 화면이 붙고, 톤은 경고가 아님.

**핵심 파일:** `recoveryCompoundSignal.ts`, `buildRecoveryPrompt.ts`, `recovery/RecoveryEntryScreen.tsx`

---

## Phase 5 — My Page (정체성)

**목표:** **해석된** 리더 상태 (숫자 덤프 아님).

| # | 체크리스트 | 상태 |
|---|------------|------|
| 1 | `/[locale]/my-page` | ✅ |
| 2 | `loadSignals` | ✅ |
| 3 | `loadReflections` | ✅ |
| 4 | `computeMetrics` | ✅ |
| 5 | `computeLeadershipState(metrics, locale, reflections)` | ✅ |
| 6 | `mergeLeadershipReflectionLayer` (성찰 스트립 등) | ✅ |
| 7 | `MyPageLeadershipScreen` — AIR/TII/리듬, next focus/cue | ✅ |

**완료 기준:** Arena + 성찰이 **문장**으로 읽힌다.

**핵심 파일:** `MyPageLeadershipConsole.tsx`, `computeLeadershipState.ts`, `mergeLeadershipReflection.ts`

---

## 반드시 지킬 5가지 (품질 가드)

1. **Arena는 평가하지 않는다** — correct/wrong/+XP 강조 금지 → 해석·기록으로 끝.
2. **Reflection은 짧고 구조적** — 에세이/감정 배출 지양 → **commitment로 닫기**.
3. **Recovery는 조용히** — 경고·위험 알림 톤 금지 → **다음 결정 보호·정렬**.
4. **My Page는 대시보드가 아니다** — 그래프/숫자 덤프 금지 → **상태 해석**.
5. **루프가 끊기면 안 된다** — Arena → Reflection → History → (Recovery) → My Page → Arena.

---

## Phase 6 — Real data flow (client) ✅

| # | Check | Status |
|---|--------|--------|
| 1 | Arena result → `pushSignal` / seed → `bty-signals` / `bty-growth-seeds` | ✅ |
| 2 | Reflection save → `bty-reflections` | ✅ |
| 3 | My Page → `loadSignals` + `loadReflections` → `computeMetrics` → `computeLeadershipState` + merge | ✅ |
| 4 | Storage keys **`bty-signals`**, **`bty-reflections`** (not `bty_signals`) | ✅ |

**Verify:** `docs/BTY_PHASE6_REAL_DATA_VERIFICATION.md`

---

## 권장 일정 (코어 1~3일)

| Day | Focus |
|-----|--------|
| **1** | Arena play + result + signal/seed 저장 |
| **2** | Reflection write + history + My Page 1차 |
| **3** | Recovery + 전체 루프 E2E |

E2E 참고: `docs/E2E_ARENA.md`, `docs/E2E_DATA_TESTIDS.md`

---

## 다음 확장 (택 1)

- **시나리오 JSON + 확장** — AI/자동 생성까지 고려한 스키마·버전 정책.
- **My Page premium identity** — 톤·모션·정보 밀도만 올리고, **비즈니스 로직은 도메인/API에 유지**.

---

## 한 줄 전략

지금 단계는 **UI 추가**보다 **데이터 흐름이 끊기지 않는지** 검증하는 것이 우선이다.

*체크리스트 버전: 1.0 — 구현 완료 시 표의 “상태” 열을 팀 규칙에 맞게 업데이트할 것.*
