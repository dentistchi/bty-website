# IA Canonical Reality (inner-main)

> Authority: canonical tree = btytrainingcenter-INNER (branch inner-main).
> 작성 B3-REBASE 2026-06-12. 본 문서가 IA reality 의 forward authority.
> 선행 IA_RESTRUCTURE_PLAN.md(D1/D4) 및 GROWTH_IA_ROUTE_MAP.md 는 superseded.

## Provenance correction
- IA_RESTRUCTURE_PLAN D1/D4 = wrong/decoy 트리(bty-website/bty-app, bty/journey/page.tsx 보유) 기준.
  canonical inner-main 미반영 → NOT EXECUTABLE.
- IA_RESTRUCTURE_PLAN master 는 frozen DO_NOT_EDIT 트리에만 존재(불가침). 본 문서로 대체 기록.

## STEP0-R measured reality (read-only inventory)
- growth/journey PAGE: inner-main 부재. journey = API-only (api/journey/bounce-back),
  유일 caller = Comeback.tsx:20.
- growth HUB page: 부재.
- D1(page removal): 제거 대상 없음 → vacuously satisfied.
- D4(growth hub removal): hub 부재로 vacuous. 문구대로 features/growth 삭제 시 DESTRUCTIVE.
- redirect alias: integrity → /bty 1개만 실재 (dojo/guidance/mentor 부재).
- reflection board → Center: 이미 완료(Center 가 getLatestReflectionSeed import). no-op.

## Invariants
- features/growth = 공유 LOAD-BEARING infra (reflection seed / recovery / history).
  Center + My Page + identity + letterService 의존. 반드시 SURVIVE. 삭제 금지.
- Comeback + api/journey/bounce-back = 전역 re-engagement residual (time-based,
  layout.tsx:32 전 route). journey-page deprecation scope 아님.

## Parked
- Comeback: 별도 micro-decision. 현 status = KEEP.

## Machine/topology note
- DO_NOT_EDIT checkout(btytrainingcenter__LOCAL_DO_NOT_EDIT) = frozen/read-only, mutation authority 無.
- outer ledger/commit flow (docs/CURRENT_TASK.md 등) 이 머신에서 차단.
  editable outer checkout 확보 전까지 outer mutation 금지.

## B1 / Decision 2 — Center display (2026-06-12, VACUOUS / already-satisfied)

판정: code 0 mutation. Decision 2는 canonical inner-main 에 이미 구현됨(IA-CENTER-FINAL).

- **Unified Current State card** = 완료. CenterPageClient.tsx:566–573 이 두 half 를 live-compose:
  - **Stage half** = `StageContextCard` (inline 정의 @ CenterPageClient.tsx:41).
    live `stage` 데이터(useState :454 + fetched payload :490, Promise.all 첫 요소),
    `stage.stageName` 실표시 + stage-3 reflection nudge. forced-reset gating(:524) 까지
    구동 = load-bearing. stub 아님.
  - **Healing half** = `HealingPhaseTracker` (embedded compact, :573), 4-stage, IA-CENTER-FINAL.
  - 카드 제목 = i18n `currentStateTitle` (현재 상태 / Current State).
- **Train primary CTA** = 충족(B1-2=(b) "시각적 1순위" 해석). first-position(:558) +
  유일 filled CTA(bg-dear-sage text-white). assessment/letters 는 outline chip(text-xs) = weight 하위.
  "유일 CTA" 아님 — assessment/letters/dear-me/reflection 전부 존치(load-bearing surface 보호).

### ⚠️ 근거 정정 (중요 — 미래 세션 오독 방지)
- B1-1 초기 승인 "Arena Stage badge = phantom → DROP" 의 **근거는 오류**. 결론(신규 작업 불요)만 맞음.
- 실제: Arena stage 는 **존재**(`StageContextCard`). STEP0 "NONE" = wrong-name grep miss —
  component 가 별도 파일 아니라 **CenterPageClient 내 inline 정의**라 `git ls-files | grep StageContextCard` 가 놓침.
- 따라서 정확한 판정: **"이미 구현되어 신규 작업 불요"** (NOT "존재하지 않아 drop").
- **B3 growth/journey(실제 부재) 와 구별**: B1 stage 는 부재가 아니라 관측 누락(inline naming).
  → 교훈: 이름 추정 단일 grep 의 NONE 은 부재 증거 아님. inline/별칭 정의 가능성 상존.

### Parked (B1 scope 밖, optional polish — IA 요구 아님)
- explicit Train hero (공유 sage shell 탈피, 카드 elevation).
- Current State double-shell de-nesting (outer :567 + inner StageContextCard :45 동일 shell 중첩, 무해).
- 둘 다 신규 product 욕구, B1 완수 조건 아님.

## C2-3 / Train Day Reflection — History shape branching (2026-06-12, DONE / already-shipped)

판정: code 0 mutation. C2-3은 canonical inner-main 에 이미 구현·배포됨(HEAD 6a2ce4e == origin/inner-main).

- **History branching** = 완료. src/app/[locale]/center/letters/LettersClient.tsx:
  - type union(:18) day_reflection 포함, responses: DayReflectionResponses 타입.
  - 분기(:186) isReflection = item.type==="day_reflection" → Q/A view vs letter view.
  - backing: domain/center/letter.ts, dayReflectionService.ts.
- **4 pending confirmations = 전부 코드로 해소**(STEP0b 본문 확인):
  1. Q label+answer: :236-243 answeredQuestions.map → qa.q(label) + qa.a(answer, whitespace-pre-wrap).
  2. Final reflection emphasis: :245-253 border-t divider + "오늘의 성찰/Today's reflection" + font-medium, finalReflection||body fallback.
  3. 빈 답변 처리: :188 filter(qa => qa.a.trim().length > 0) — blank 답변 render 전 제거.
  4. reflection title: :222-224 isReflection && responses?.title → collapsed header semibold.
  - stub 신호 없음. bilingual strings 완비.

### ⚠️ 메모리 drift 정정 (중요 — 미래 세션 오독 방지)
- **렌더 위치**: 메모리 "page.client L331" → 실제 **page.client.tsx:391** (TrainDayReflectionSet, import :7).
  train/day/[day]/page.client.tsx 단일 렌더, 타 4 train page 무참조.
- **deploy-held = 거짓**: 메모리 "Deploy held pending C2-3" 였으나 C2-2/C2-3 **이미 배포**
  (HEAD 6a2ce4e == origin/inner-main, held state 없음). C2-2 committed 후 실제 pushed 됨.
- **branching 위치**: 메모리 "History shape branching"(파일 미특정) → 실제 **Center letters History**
  (center/letters/LettersClient.tsx). Train Day reflection 이 Center letters History 에서 분기.
- 교훈(B1 동형): 결론(DONE) 맞으나 메모리 좌표 부정확. 코드가 진실.

### Backlog
- TrainDayCapture.tsx = orphan(5축 검증: dynamic/lazy/barrel/test/string ref 0, render swap L391).
  prune 대상 — 별도 source mutation dispatch.
- legacy type:'reflection' DB rows 잔존 가능(구 TrainDayCapture 경로). History 양쪽 처리하므로 무해, 데이터 정리 불요.
