# Train / Awakening / History — Master Roadmap (DRAFT)

작성: 이 챗 Claude (dispatch author / arbiter, NON-MUTATING)
상태: 초안 — 대부분 항목 STEP 0 미실시. 위험도·트랙·의존성은 잠정 추정.
이 문서는 "확정 설계"가 아니라 "무엇을·어떤 순서로·어디서 멈춰 결정할지"의 지도다.
mutation 0. 모든 실행은 Commander → 이 챗 → Claude Code 단일 스트림.

---

## 0. 완료 (LIVE, 검증됨)

| ID | 내용 | 커밋 | Version | 비고 |
|----|------|------|---------|------|
| C1 | 레슨 섹션 헤더 위계 (라벨 경계 파서 + 위 여백 24/8) | 3b22e6e9 | 29cf5f27 | byte-identical, 모바일 육안 OK |
| C2 | 레슨 섹션 헤더 SVG 아이콘 (7 outline, currentColor) | 95d89178 | 95a74134 | byte-identical, 다크모드 상속 OK |
| C-EXT | /train/28days 허브 카피 i18n (t.title + journeyStart* 재사용) | 0046b9c3 | fd5d789d | EN 한글 누출 + 반말 톤 해소, 신규 키 0 |
| #8b | 28days→day nav 2-hop 크래시 수정 (#310, hop 제거) | 320161ec | ae43c973 | href 직행화, awakening 무관 |
| pad | /train/28days 좌측정렬 (p-6, train/start 패턴) | f47d4039 | bace9183 | 콘텐츠 좌우 여백 |

적용 표면: /train/day/[day] (page.client.tsx) + /train/28days (page.tsx 허브).
정정 완료(2026-06-13 ledger): C1+C2 정정 + C-EXT/#8b/pad 동시 기록 (docs/CURRENT_TASK.md).

---

## 1. 스크린샷이 교정한 사실 (위험도 재산정 근거)

- (A) 임의 날 재진입은 이미 부분 작동 — 28일 전부 Done 상태에서 각 day 클릭 가능 + "Review past reflections →" 존재. → 요청 #3은 이미 됨 가능성. "정말 막혔나 vs 진입 경로만 안 보이나"를 STEP 0가 가른다. 위험 ↓.
- (B) ~~Awakening 미완료 시 client-side exception~~ → 재분류·RESOLVED: 원 진단(awakening 렌더 터짐 / progress-null) 오류. 실제 2계통 — (a) /train/28days 빈약 랜딩 미번역 카피 = C-EXT, (b) /train/28days/day/1→/train/day/1 2-hop redirect 전이 React #310(hook-tree 불일치) = #8b(hop 제거). progress-null-가드 가설 폐기, awakening 무관.
- (C) C1/C2 미적용 2차 표면 — Center/Completion 계열 화면(Dear Me 버튼 있는 뷰)이 섹션 라벨을 평문으로 렌더 중(C1 이전 모습). → C1/C2 패턴을 두 번째 컴포넌트에도 적용 필요. 요청 #6과 동류.
- (D) "몇 번의 클릭" = Awakening 게이팅 흐름 — "Go to the 28-day training" → "Awakening →" 다단계 버튼 체인. 미완료 시 중간에서 에러(B).

---

## 2. 전체 항목 (분류 · 잠정 위험도 · B3 의존 · STEP 0)

> B3 = 메모리상 HIGH RISK 동결 트랙 (journey 제거 + Growth hub 해체 + history→Center 이전, Comeback 컴포넌트 layout.tsx:32 전역 렌더). absorption/migration 먼저, 제거 마지막.

| # | 요청 | 트랙 분류 | 위험(잠정) | B3 의존 | STEP 0 필요 | 비고 |
|---|------|-----------|------------|---------|-------------|------|
| 6 | History 타이포 강조 + 아이콘 (C1/C2 동형) | 표시 레이어 | LOW | 약함 | 예(History 컴포넌트 위치) | C1/C2 직속 연장 |
| C-EXT | C1/C2 미적용 2차 표면(Center/Completion Dear Me 뷰) | 표시 레이어 | LOW | 약함 | 예(어느 컴포넌트·같은 raw인가) | (C) 발견 |
| 5 | Center Dear Me 입력칸 → History 링크 | 링크 추가 | LOW~MED | 중간(history→Center가 B3) | 예(Center 구조·History 라우트) | B3와 일부 겹침 |
| 8 | ~~Awakening 미완료 시 에러~~ → 재분류: 28days 허브 카피(C-EXT) + 2-hop redirect #310 크래시(#8b) | 버그/표시 | RESOLVED | — | 완료 | 원 진단 오류; live fd5d789d/ae43c973; awakening·progress-null 무관 |
| 7 | Live ranking 잘림 | 버그/UI | MED | 낮음 | 예(ranking 컴포넌트·잘림 원인) | 별개, 독립 |
| 3 | 임의 날(1~28) 재진입/열람 | 상태/게이팅 | LOW~MED | 중간 | 예(이미 되는지 확인부터) | (A) 이미 부분 작동 |
| 1 | 재진입 차단 해제 (50문항 강제) | 상태 머신 | MED~HIGH | 높음 | 예(완료 판정·assessment gate) | Awakening gate(B2) 인접 |
| 2 | "다시 28일 진행할까요?" 재시작 옵션 | 상태 머신 | MED~HIGH | 높음 | 예(reset vs 새 사이클 결정) | 제품 결정 선행 |
| 4 | History 진행 시점 표 + 달력 표시 | 신규 데이터 뷰 | MED~HIGH | 높음 | 예(진행 시점 DB 기록 여부) | history→Center = B3 범위 |

C-EXT = (C)에서 발견된 미적용 표면. "C3" 라벨은 메모리상 폐기 → "C-EXT" 별칭 사용.

---

## 3. 제품 결정 선행 (#1·#2·#3 = "재진입 모델")

코드 STEP 0 전에 제품 결정이 먼저. 이 결정 없이 코드 보면 "구조 추측".

- 재시작(#2) = 기록 초기화인가, 새 사이클 추가(과거 보존)인가?
- 임의 날(#3) = 읽기전용 열람인가, 다시 완료 카운트되나? (스크린샷상 이미 열람은 됨)
- assessment(50문항) 재실시 강제(#1) = 의도였나 버그였나?
- 완료 판정 불변식: Awakening gate(B2, TRAIN_REQUIRED_DISTINCT_DAYS=28, eligible = !completed && trainDistinct === 28)와 충돌 안 하는가? 재시작이 completed/trainDistinct를 어떻게 다루는지가 gate·LRI에 직접 영향.

---

## 4. 권고 순서 (arbiter)

Phase A — LOW, 즉시 (B3 거의 무관, 테스터 흐름 유지):
1. #6 History 타이포+아이콘 (C1/C2 동형)
2. #C-EXT 2차 표면(Center/Completion Dear Me 뷰)에 C1/C2 적용
3. #5 Dear Me → History 링크

Phase B — 버그 (독립, 테스터 차단 해소):
4. ~~#8 Awakening 미완료 에러~~ → RESOLVED (C-EXT 카피 + #8b 2-hop #310 hop 제거; progress-null-가드 가설 폐기)
5. #7 Live ranking 잘림

Phase C — 제품 결정 → 상태 머신 (재진입 모델):
6. #1·#2·#3 제품 결정 합의 → STEP 0 → 설계

Phase D — B3 정렬 (HIGH):
7. #4 History 표/달력 + 재진입 데이터 = B3 한 트랙으로 (history→Center가 B3 범위라 따로 만들면 두 번 만듦)

---

## 5. 미해결 / 확인 필요

- C1+C2 ledger 정정 (outer docs-only) — 정정 완료(2026-06-13, docs/CURRENT_TASK.md, C-EXT/#8b/pad 동시).
- #4·#1~3이 B3와 겹치는 정도 — B3 STEP 0 전엔 충돌 범위 미확정.
- (C) 2차 표면이 /train/day 와 같은 page.client.tsx인지 별 컴포넌트인지 — STEP 0로.
- #8 에러 = /train/day/[day] C1/C2 배포와 무관(다른 라우트). 회귀 아님.
- #8 추적 = 표면 5회 이동(train/day → awakening → train/28days → day-진입 크래시 → 2-hop 전이), inventory/스택/cross-check가 매 단계 inference 교정. 최종 확정 = console React #310 스택 + /train/day/1 직접진입 정상 cross-check.
- 잔여(후속): redirect 스텁 (train/28days/day/[day]) inbound 0 = dead-but-harmless(삭제는 선택, 이번 비대상). ②-2 잠긴-day bounce(day-게이트 → /train/28days 허브)는 재진입 모델(#1·2·3) 인접 — B3 STEP 0에서 함께 다룸.
