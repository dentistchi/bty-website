# 지금까지 마무리된 것 · 다음에 할 일

**기준**: `docs/NEXT_STEPS_RUNBOOK.md` §6-4 완료 기록, `docs/CURRENT_TASK.md`, `docs/PROJECT_BACKLOG.md`  
**용도**: 커맨더가 "지금까지 뭘 했고, 다음에 뭘 시키면 되지?"를 한 파일에서 보려고 할 때.

---

## 1. 마무리된 것 (기준)

### 1-1. 백로그·태스크 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| BACKLOG §1 리더보드 nearMe (위5+나+아래5) | [x] | slice myRank+6 적용 |
| BACKLOG §2 Arena Level MVP 후 숨기기 | [x] | 플래그로 제어 |
| BACKLOG §3 Partner S1~L4 시나리오 노출 | [x] | unlocked-scenarios·program 점검 |
| BACKLOG §4 엘리트 5% 정책 | [x] | ELITE_5_PERCENT_POLICY.md |
| BACKLOG §5 엘리트 특혜 선정 | [x] | 해금 콘텐츠·멘토 배지 등 |
| BACKLOG §6 언어 선택 시나리오·안내·대답 | [x] | NEXT_TASKS_2 §1-5 |
| BACKLOG §7 Dojo 50문항·연습 플로우 1종 (2차) | [x] | DOJO_DEAR_ME_NEXT_CONTENT §5 체크리스트 |
| BACKLOG §8 빈 상태·로딩 (BRIEF §2) | [x] | PageLoadingFallback 14곳 + 인라인 7곳, EmptyState 통일 |
| BACKLOG §9 챗봇 훈련 | [x] | NVC·치유 스펙, 메타/인사, few-shot, Lint·Vitest 10/10 PASS |

### 1-2. Dojo·Dear Me 2차 (옵션 A)

- **진입·Dear Me 1차 플로우**: 구현 완료, 검증·재검증 **PASS**.
- **2차 전체 검증용 체크리스트**: `docs/DOJO_DEAR_ME_2ND_VERIFICATION.md` (항목 1~10). 1차·재검증 기록은 `docs/DOJO_DEAR_ME_VERIFICATION_CHECKLIST.md`.

### 1-3. 감정 스탯 (Core Stats / Events / Advanced Stats)

- **Phase A1–F1**: 도메인 → DB → API → UI 반영 완료 (coreStats, formula, unlock, antiExploit, 마이그레이션, record-event/display API, 챗/멘토 연동, UI phrases).
- **v3 확장**: 이벤트 15종·stat_distribution·30일 가속 등은 `docs/HEALING_COACHING_SPEC_V3.md`·`docs/specs/healing-coaching-spec-v3.json` 기준으로 진행 가능.

### 1-4. BRIEF §2 (빈 상태·로딩)

- **로딩 전역 통일**: PageLoadingFallback 공통, Suspense fallback 14곳 + 인라인 7곳 → 아이콘 + "잠시만 기다려 주세요." + 카드형 스켈레톤.
- **빈 상태**: 리더보드·ArenaLevelsCard·감정 스탯 EmptyState, i18n arenaLevels.noLevelsYet·emptyCta.

### 1-5. Cursor 4 (Arena 코드네임·아바타) — 구현·마이그레이션 완료

- **구현 완료**: 리더보드 아바타 역전(requireUser 통일), 코드네임 코드별 1회(sub_name_renamed_at_code_index), 캐릭터+옷 1단계(avatar_selected_outfit_id, 대시보드 "선택한 옷" 드롭다운).
- **마이그레이션**: ✅ 3개 적용 완료 (`scripts/apply-arena-avatar-migrations.sql`: avatar_character_locked → sub_name_renamed_at_code_index+백필 → avatar_selected_outfit_id). (선택) Cursor 2 검증만 남음.

### 1-6. 배포 전 체크 (bty-release-gate)

- **결과**: **PASS** (재실행 완료). NEXT_TASKS_2 §1-2, bty-release-gate.mdc 기준.
- **요약**: A~E 항목 규칙 위반 없음. 배포 후에는 Verification Steps 1~4만 실행하면 됨.
- **배포 후 할 일**: 로컬 1–2 → Preview 3 → Production 4 실행. 상세는 `docs/NEXT_STEPS_RUNBOOK.md` §6-5.

---

## 2. 다음에 할 일 (선택지)

### 2-1. 우선 처리 (배포 전)

| 누구에게 | 할 일 | 복사용 프롬프트 |
|----------|--------|------------------|
| **Cursor 4** | 마이그레이션 3개 적용 완료 | ✅ 적용됨 (`scripts/apply-arena-avatar-migrations.sql`). (선택) Cursor 2에 「아바타·코드네임 계획 검증해줘」 지시 가능. |
| **Cursor 2** | 배포 전 체크 (재실행 시) | `docs/NEXT_TASKS_2.md §1-2: .cursor/rules/bty-release-gate 규칙에 맞게 배포 전 체크 실행해줘.` *(최근 1회 **PASS** 완료. 배포 후 Verification Steps만 실행하면 됨 — RUNBOOK §6-5.)* |

### 2-2. 구현·확장 (Cursor 1)

| 할 일 | 복사용 프롬프트 |
|--------|------------------|
| Dojo 2차 확장 (50문항·연습 플로우 2~5단계) | `PROJECT_BACKLOG §7: Dojo 50문항 목차 또는 연습 플로우 1종 스펙 정리·진입/1단계 구현해줘. docs/DOJO_DEAR_ME_NEXT_CONTENT.md 참고.` (이미 §7 [x]. 2차 확장은 §1-4·§6 스펙으로 추가 구현.) |
| 감정 스탯 v3 확장 | `docs/HEALING_COACHING_SPEC_V3.md`, docs/specs/healing-coaching-spec-v3.json 읽고, 이벤트 15종·stat_distribution·30일 가속 등 v3 스펙 반영해줘. (Phase A1–F1은 완료됨.)` |

### 2-3. 검증 (Cursor 2)

| 할 일 | 복사용 프롬프트 |
|--------|------------------|
| Dojo·Dear Me 2차 구현 검증 | `docs/DOJO_DEAR_ME_2ND_VERIFICATION.md 체크리스트(항목 1~10) 순서대로 확인해줘. DOJO_DEAR_ME_NEXT_CONTENT.md §4·§5·§6·§2-2·§1-4·§6 스펙 기준. 결과를 PASS/FAIL + 불충족 항목으로 보고하고, 해당 문서 하단 검증 결과 템플릿에 검증 일시·결과·비고 적어줘.` |
| 아바타·코드네임 검증 (선택) | `docs/ARENA_CODENAME_AVATAR_PLAN.md 읽고, Cursor 4가 반영한 리더보드 아바타·코드네임 코드별 1회·캐릭터+옷 1단계가 스펙과 규칙을 만족하는지 검증해줘. 결과를 PASS/FAIL + 이슈 목록으로 보고해줘.` |

### 2-4. 다음 할 일 정하기 (한 줄 적기)

**대상:** 커맨더가 **지금 대화하는 Cursor 에이전트**에게 복사해서 넣을 때 사용. (특정 Cursor 번호 아님.)

```
docs/CURRENT_TASK.md, docs/PROJECT_PROGRESS_ORDER.md, docs/PROJECT_BACKLOG.md를 읽어줘.

다음에 할 작업을 한 줄로 정해서 docs/CURRENT_TASK.md "이번에 구현할 기능" 칸에 적어줘. 백로그 §1~§9는 완료된 상태니까, PROJECT_PROGRESS_ORDER §3(Dojo·Dear Me 2차 확장)이나 감정 스탯 v3, 새 백로그 항목 중에서 골라서 적으면 돼.
```

---

## 3. 참고 문서

| 용도 | 문서 |
|------|------|
| 누가 뭘 하는지·누구에게 뭘 지시할지 | `docs/COMMANDER_CURSORS_REF.md` |
| 현재 상태·Cursor 4 할 일·복사용 프롬프트 표 | `docs/NEXT_STEPS_RUNBOOK.md` §6 |
| 이번에 구현할 기능(비어 있으면 여기 적기) | `docs/CURRENT_TASK.md` |
| Dojo·Dear Me 2차 검증 체크리스트 | `docs/DOJO_DEAR_ME_2ND_VERIFICATION.md` |
| Arena 코드네임·아바타 계획 | `docs/ARENA_CODENAME_AVATAR_PLAN.md` |
| 감정 스탯 v3 스펙 | `docs/HEALING_COACHING_SPEC_V3.md`, `docs/specs/healing-coaching-spec-v3.json` |

---

*이 문서는 RUNBOOK §6-4·CURRENT_TASK·PROJECT_BACKLOG를 기준으로 정리함. 반영 시점 이후 완료/추가된 항목은 RUNBOOK·CURRENT_TASK를 우선 참고.*
