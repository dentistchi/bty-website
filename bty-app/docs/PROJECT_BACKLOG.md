# 프로젝트 백로그

진행 에이전트가 구현할 때 **`docs/CURRENT_TASK.md`** 또는 커맨더 지시와 함께 참고하는 작업 목록입니다.

---

## 1. 리더보드: 내 위 5명, 내 아래 5명

**요구**: 리더보드에서 "내 순위" 기준으로 **내 위 5명 + 나 + 내 아래 5명**만 보이게 한다.

- **현재**: `nearMe` = `slice(myRank - 6, myRank + 5)` → 위 5명 + 나 + 아래 4명.
- **변경**: `nearMe` = **위 5명 + 나 + 아래 5명** (총 11명).
- **수정 위치**: `src/app/api/arena/leaderboard/route.ts` — `nearMe` 계산 시 `slice(Math.max(0, myRank - 6), Math.min(leaderboard.length, myRank + 6))` 로 변경 (아래 5명까지 포함).
- **완료 기준**: 리더보드 페이지에서 내 위치 기준 위 5명·아래 5명 노출 확인.

| 상태 |
|------|
| [x] 구현 완료 (slice myRank+6 적용) |

---

## 2. 대시보드 Arena Level: MVP 후 숨기기

**요구**: MVP에서는 대시보드에 **Arena Level**(S1/S2…L4 카드)을 **보이게** 두고, **MVP 이후**에는 **안 보이게** 전환할 수 있게 한다.

- **현재**: `ArenaLevelsCard` 가 대시보드에 항상 노출 (`dashboard/page.client.tsx`).
- **변경**: 환경 변수 또는 기능 플래그(예: `NEXT_PUBLIC_SHOW_ARENA_LEVELS=true|false`)로 제어. MVP 이후에는 `false` 로 설정해 카드 숨김.
- **수정 위치**: `src/app/[locale]/bty/(protected)/dashboard/page.client.tsx` — Arena Level 카드 렌더 조건에 플래그 추가.
- **완료 기준**: 플래그 off 시 Arena Level 카드 미노출, on 시 기존처럼 노출.

| 상태 |
|------|
| [x] |

---

## 3. Partner인데 시나리오가 기초(S1)만 나오는 문제 — S1~L4 노출

**요구**: **Partner**(리더 트랙) 사용자인데 시나리오가 기초 단계만 보이는 문제 해결. **S1/S2/S3 + L1/L2/L3/L4** 가 tenure·직군에 맞게 보이도록 설정/로직 점검 및 수정.

- **의심 원인 (점검 대상)**  
  - `job_function` 이 `"partner"` 로 저장돼 있는지 (DB `arena_membership_requests`).  
  - `getEffectiveTrack` → `"leader"` 반환하는지 (partner 는 `LEADER_JOB_FUNCTIONS` 에 포함).  
  - `leader_started_at` 이 설정돼 있는지 (리더 트랙 tenure 기준).  
  - New joiner 30일 규칙: 가입 30일 이내면 강제 staff → 30일 지나면 leader 레벨 노출.  
  - `getUnlockedContentWindow` 의 tenure 계산·`JOB_MAX_LEVEL_CAP` (partner → L4) 적용.  
- **수정 위치**:  
  - `src/app/api/arena/unlocked-scenarios/route.ts` (track, maxUnlockedLevel, levels 반환).  
  - 필요 시 `src/lib/bty/arena/program.ts`, `src/lib/bty/arena/unlock.ts` (track·tenure·캡 로직).  
- **완료 기준**: Partner 계정으로 로그인 시 S1~S3 + L1~L4(또는 tenure/L4 권한에 맞는 범위) 시나리오가 노출되고, 기초만 나오는 현상 해소.
- **확인 목록**: 가입·레벨에 따른 시나리오 노출 전반은 **`docs/SCENARIO_UNLOCK_VERIFICATION.md`** 참고. 검증 시 해당 문서의 체크박스를 **순서대로** 확인하면 됩니다.

| 상태 |
|------|
| [x] |

---

## 4. 엘리트 5% 정책: 주간 vs 시즌, 특혜 부여·아이템

**요구**: 주간 상위 5%를 **보여주기만** 할지, **특혜(혜택)** 를 줄지 결정. **시즌 5% 엘리트**가 더 중요하다면, 혜택을 시즌 기준으로 하거나 **주간/시즌 5%를 선택·교환 가능한 아이템**으로 할지 정책 정리.

- **참고**: `docs/PHASE_4_ELITE_5_PERCENT_SPEC.md` §6 (주간 vs 시즌 5% 검토).
- **결정 항목**: (1) 주간 5%만 노출 vs 특혜 부여 (2) 시즌 5% 정의·판정 (3) 주간/시즌 혜택 분리 또는 통합 (4) “아이템으로 바꿀 수 있게” 할지(선택권·교환).
- **산출물**: 1페이지 정책 요약 또는 스펙 §6 보강. 4-4 구현 전에 확정 권장.
- **산출**: **`docs/ELITE_5_PERCENT_POLICY.md`** (주간 vs 시즌, 노출 vs 특혜, 혜택 통합/분리·아이템 보류).

| 상태 |
|------|
| [x] |

---

## 5. 엘리트 5% 특혜 아이디어 정리·선정

**요구**: 시즌/주간 5% 엘리트에게 줄 **특혜 후보**를 정리하고, 우선순위·구현 순서를 정한다.

- **아이디어 후보** (상세: `docs/PHASE_4_ELITE_5_PERCENT_SPEC.md` §7):
  - **멘토와의 대화 신청**: Elite가 멘토(또는 Dr. Chi)와 1:1 대화/세션 신청 권한. 신청 큐·승인 플로우.
  - **서클(Circle) 모임**: Elite 전용 소규모 모임(주/월 1회). 일정·참여 UI·알림.
  - **특별 트레이닝 세션**: Elite만 참여 가능한 트레이닝/워크숍(실시간 또는 온디맨드).
  - **엘리트 배지 증정**: 시즌/주간 5% 달성 시 배지 수여. 기존 “상위 5%” 뱃지 확장.
  - **해금 콘텐츠**: Elite만 접근 가능한 시나리오/에피소드 (스펙 §4-1).
  - **멘토 배지·노출 확장**: “Elite 멘토” 문구·아이콘 (스펙 §4-2).
- **산출물**: 위 후보 중 **1~2차 구현할 항목** 선정·한 줄 스펙. 4-4 작업과 연동.
- **산출**: **`docs/PHASE_4_ELITE_5_PERCENT_SPEC.md`** §10 — 1차 해금 콘텐츠, 2차 멘토 배지 확장(완료), 3차 후보(엘리트 배지 증정·멘토 대화 신청) 한 줄 스펙.

| 상태 |
|------|
| [x] |

---

## 6. 언어 선택에 따른 시나리오·안내·대답 통일 (한국어/영어)

**요구**: 사용자가 **한국어**를 선택하면 시나리오·안내 문구·시스템 대답이 **한국어**로, **영어**를 선택하면 **영어**로 나오게 한다.

- **locale**: URL 경로(예: `/ko/bty-arena`, `/en/bty-arena`) 또는 설정·쿠키로 결정. 시나리오 콘텐츠·UI 안내·API 응답(시스템 메시지·피드백·리플렉션 프롬프트 등)에서 locale 사용.
- **수정 범위**: 시나리오 데이터(ko/en 필드 또는 로케일별 데이터), i18n(getMessages(locale)), Arena·리플렉션·free-response 등 API에서 locale 전달·응답 언어 분기.
- **완료 기준**: 한국어 선택 시 시나리오·안내·대답 전부 한국어, 영어 선택 시 전부 영어로 표시·응답됨.
- **상세·프롬프트**: `docs/NEXT_TASKS_2.md` §1-5.

| 상태 |
|------|
| [x] (NEXT_TASKS_2 §1-5 구현으로 완료) |

---

## 7. Dojo 50문항 목차 또는 연습 플로우 1종 (2차)

**요구**: `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §1(Dojo 1차 콘텐츠) 기준으로, **50문항 분석** 목차·스펙 또는 **연습 플로우 1종** 스펙/목차를 확정하고, 필요 시 진입 화면·플로우 1단계까지 구현한다.

- **1차**: 문서상 목차·스펙만 확정. **2차**: 문항 세트·선택지 또는 연습 플로우 1개를 스펙(단계 수·화면 수)으로 정리하고, 가능하면 진입 → 1단계 UI/API까지 구현.
- **수정 범위**: `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` 보강, 필요 시 `src/app/[locale]/bty/` Dojo 관련 라우트·컴포넌트, 기존 멘토 API 또는 Dojo 전용 엔드포인트.
- **완료 기준**: 50문항 목차 또는 연습 플로우 1종이 문서에 정리되고, 선택 시 진입·1단계가 동작함.
- **2차 완료 확인**: `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §5 체크리스트 및 §1-4·§4 참고.

| 상태 |
|------|
| [x] |

---

## 8. 빈 상태(empty state) 보강 (선택)

**요구**: DESIGN_FIRST_IMPRESSION_BRIEF §2 "빈 상태·로딩"에 따라, **데이터가 없을 때** 스피너만 두지 말고 **일러/아이콘 + 한 줄 문구**(예: "아직 기록이 없어요. 첫 시나리오를 시작해 보세요.")를 넣는다.

- **적용 후보**: 리더보드 빈 목록, 대시보드 특정 카드 빈 상태, Arena 진입 전 빈 상태 등.
- **수정 범위**: 해당 페이지/컴포넌트의 empty state 렌더 부분. 로딩은 이미 카드형 스켈레톤 적용됨.
- **완료 기준**: 후보 구간 중 최소 1곳 이상에서 빈 상태 시 일러/아이콘 + 문구가 표시됨.

| 상태 |
|------|
| [x] |

---

## 9. 챗봇 훈련 (MVP 직전)

**요구**: 로드맵 "챗봇 훈련 시기"에 따라, **시스템 프롬프트·예시·필요 시 RAG**를 한 번 설계·반영한다.

- **참고**: `docs/ROADMAP_NEXT_STEPS.md` § 챗봇 훈련 시기, `docs/CHATBOT_TRAINING_CHECKLIST.md`.
- **훈련 내용**: (1) 시스템 프롬프트 보강 — 역할·말투·금지 표현 (2) 구역별(bty / today-me) 예시 대화 몇 턴 (3) "챗봇이 되나?" 등 메타 질문 답변 가이드 (4) 선택: BTY·Dear Me 소개 문구 RAG.
- **수정 범위**: `src/app/api/chat/route.ts`(시스템 프롬프트·필터), `src/components/Chatbot.tsx`(소개 문구·라벨), 필요 시 few-shot·RAG.
- **완료 기준**: CHATBOT_TRAINING_CHECKLIST §2·§3 항목 점검 후, 미확정 항목(§3 [ ]) 정리·반영. Dojo/Dear Me 구역별 말투·역할이 코드에 반영됨.
- **구현 요약**: `src/lib/bty/chat/buildChatMessages.ts`(NVC 스펙·메타/인사/BTY·Dear Me 소개 가이드·few-shot), `src/lib/bty/chat/chatGuards.ts`(isMetaQuestion, getMetaReply), `src/app/api/chat/route.ts`(메타 질문 시 고정 답변 반환). CHATBOT_TRAINING_CHECKLIST §3 항목 반영.

| 상태 |
|------|
| [x] |

---

*진행 시 위 체크박스를 `[x]` 로 업데이트하세요. 상세 지시는 `docs/CURRENT_TASK.md` 또는 `docs/NEXT_TASKS_2.md` 를 따릅니다.*
