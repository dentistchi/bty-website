# 시나리오 노출 설정 확인 목록

**목적**: “기본 시나리오만 보이다가, 가입·승인 후 레벨이 정해지면 그에 맞는 시나리오(레벨)가 보이도록” 설정된 동작을 확인하기 위한 체크리스트.

**관련 코드**: `GET /api/arena/unlocked-scenarios`, `arena_membership_requests`, `getEffectiveTrack`·`getUnlockedContentWindow`, 대시보드 `ArenaLevelsCard`.

**최근 검증**: 코드 기준으로 §1~§4 항목 검증 완료. 런타임(비로그인 401, 실제 DB 멤버십) 확인은 수동 테스트 권장.

---

## 1. API: GET /api/arena/unlocked-scenarios

| # | 확인 항목 | 기대 결과 | 체크 |
|---|-----------|-----------|------|
| 1-1 | 비로그인 | 401 Unauthorized | [x] |
| 1-2 | 로그인했으나 **멤버십 없음** (arena_membership_requests 에 해당 user_id 없음) | `membershipPending: true`, `levels: []`, `track: "staff"` | [x] |
| 1-3 | 로그인했으나 **멤버십 미승인** (status !== "approved") | `membershipPending: true`, `levels: []` | [x] |
| 1-4 | **멤버십 승인** + job_function(직군)·tenure(가입일/리더 시작일) 존재 | `membershipPending: false`, `track`·`maxUnlockedLevel`·`levels` 채워짐 | [x] |
| 1-5 | **Staff 트랙** (예: doctor, assistant): tenure에 따라 S1 → S2 → S3 | `track: "staff"`, `levels` 에 S1~(maxUnlockedLevel) 까지 포함 | [x] |
| 1-6 | **Leader 트랙** (예: partner, senior_doctor): tenure + leader_started_at 에 따라 L1~L4 | `track: "leader"`, `levels` 에 L1~(maxUnlockedLevel) + **S1,S2,S3** (아랫단계 포함) | [x] |
| 1-7 | **L4(Partner)** 는 tenure으로 열리지 않음. admin이 `arena_profiles.l4_access` 부여 시에만 | `l4_access: true` 이면 `maxUnlockedLevel: "L4"` 가능, `levels` 에 L4 포함 | [x] |

---

## 2. 데이터·직군 설정

| # | 확인 항목 | 기대 결과 | 체크 |
|---|-----------|-----------|------|
| 2-1 | `arena_membership_requests.job_function` 이 **partner** 이면 | `getEffectiveTrack` → `"leader"` (LEADER_JOB_FUNCTIONS 에 partner 포함) | [x] |
| 2-2 | **Leader** 트랙인데 `leader_started_at` 이 null 이면 | tenure 기준이 joinedAt 폴백. 리더 레벨(L1~L4)은 leader_started_at 기준이므로 기대치 확인 필요 | [x] |
| 2-3 | **New joiner 30일** 규칙: 가입 30일 미만이면 | 강제 staff 트랙 → S1~S3 만. 30일 지나면 job_function 에 따라 leader 가능 | [x] |

---

## 3. UI: 대시보드 Arena Level 카드

| # | 확인 항목 | 기대 결과 | 체크 |
|---|-----------|-----------|------|
| 3-1 | **멤버십 대기 중** (membershipPending 또는 levels 빈 배열) | “멤버십 승인 대기 중” 등 문구만 표시, 레벨 스텝 비표시 | [x] |
| 3-2 | **멤버십 승인 후** (levels 길이 > 0) | track·maxUnlockedLevel·레벨 스텝(S1/S2/S3 또는 L1~L4) 표시 | [x] |
| 3-3 | **Staff** 사용자 | S1, S2, S3 스텝만 표시. maxUnlockedLevel 까지 강조 | [x] |
| 3-4 | **Leader** 사용자 (l4_access 없음) | L1, L2, L3 스텝 + maxUnlockedLevel 까지 강조 | [x] |
| 3-5 | **Leader + l4_access** | L1, L2, L3, L4 스텝 표시, L4까지 언락 가능 | [x] |

---

## 4. 요약: “기본 → 가입·레벨 후 다른 시나리오” 흐름

| 단계 | 기대 동작 | 체크 |
|------|-----------|------|
| 가입 전 / 미승인 | 기본만: membershipPending 또는 levels 빈 배열 → 대시보드에서 “승인 대기” 등만 노출 | [x] |
| 가입·승인 + 레벨 산출 | `unlocked-scenarios` 가 track·tenure·job_function 으로 maxUnlockedLevel·levels 반환 → 대시보드에 해당 레벨(S1~S3 또는 L1~L4) 노출 | [x] |
| Partner 등 Leader 인데 기초만 나오는 경우 | PROJECT_BACKLOG §3 점검: job_function, leader_started_at, new joiner 30일, unlock 로직 | [x] |

---

**관련 파일**

- API: `src/app/api/arena/unlocked-scenarios/route.ts`
- Track/tenure: `src/lib/bty/arena/program.ts`, `src/lib/bty/arena/unlock.ts`
- UI: `src/app/[locale]/bty/(protected)/dashboard/page.client.tsx` (ArenaLevelsCard), `src/components/bty-arena/ArenaLevelsCard.tsx`
