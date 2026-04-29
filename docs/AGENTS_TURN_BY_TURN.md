# 진행 ↔ 검증 번갈아 하기 (단계별)

**방식**: 한 커서는 **진행**, 다른 커서는 **검증**.  
**순서**: 단계 1 진행 → 단계 1 검증 → 단계 2 진행 → 단계 2 검증 → … (진행이 한 단계 끝나면 검증이 그 단계 검증.)

**역할**
- **진행 에이전트**: 아래 각 단계의 「진행 할 일」 프롬프트를 받고 구현.
- **검증 에이전트**: 진행이 끝난 단계에 대해 「검증 할 일」 프롬프트로 점검 후 결과 보고 (PASS/FAIL, 발견 이슈 목록).

---

## 단계 1: 첫인상 — 히어로 + 여백

### 1-1. 진행 (Cursor 1)

```
docs/DESIGN_FIRST_IMPRESSION_BRIEF.md §4 프롬프트 A를 적용해줘.

- 대시보드 상단: "오늘도 한 걸음, Arena에서." / "One step today, in the Arena." 를 히어로 블록으로. 폰트 크기 1.75rem~2rem, font-weight 700, 상하 여백 32px~48px. 카드 영역과 시각적 분리.
- Arena(/bty-arena) 첫 화면도 동일: 한 문장 히어로 + 넉넉한 여백 후 본문.
- 카드 그룹 간 세로 gap 24px~32px, max-width 유지.
```

### 1-2. 검증 (Cursor 2)

```
방금 진행 에이전트가 적용한 "첫인상 히어로+여백"을 검증해줘.

- 대시보드(/en/bty/dashboard, /ko/bty/dashboard): 상단에 한 문장이 크게(1.75rem 이상) 보이고, 그 아래 카드와 여백으로 분리돼 있는지 확인.
- Arena(/en/bty-arena, /ko/bty-arena): 첫 화면에 히어로 문구 + 여백이 있는지 확인.
- docs/AGENTS_SHARED_README.md·bty-ui-render-only: UI가 XP/랭킹 계산을 하지 않고 API 값만 표시하는지 확인. 이번 변경이 규칙 위반인지 점검.
- 결과를 PASS/FAIL + 발견 이슈 목록(있으면)으로 보고해줘.
```

**검증 결과 (단계 1)**  
- **PASS** · 발견 이슈: 없음.  
- 선택 개선 제안: 대시보드에서 "상단 = 히어로 한 문장"을 더 강조하려면, "bty" / "Dashboard" 블록을 히어로 아래로 옮기거나 히어로를 페이지 최상단으로 올리는 UX 검토를 고려할 수 있음. (현재 요구사항 충족에는 문제 없음.)

---

## 단계 2: 첫인상 — 포인트 폰트 + 악센트 색

### 2-1. 진행 (Cursor 1)

```
docs/DESIGN_FIRST_IMPRESSION_BRIEF.md §4 프롬프트 B를 적용해줘.

- 제목·로고: 웹폰트 1종 적용 (Pretendard Variable 또는 Noto Sans KR). 제목만 font-weight 700~800, 크기 1.5rem 이상.
- 악센트 색 1개: CSS 변수 --arena-accent (예: #5B4B8A 또는 세이지). 버튼(primary), 활성 네비 탭, 프로그레스 바에만 사용. 배경 크림 유지.
- 본문 line-height 1.6 유지.
```

### 2-2. 검증 (Cursor 2)

```
방금 진행 에이전트가 적용한 "포인트 폰트 + 악센트 색"을 검증해줘.

- 제목·로고에 지정한 웹폰트가 적용돼 있는지, 악센트 색이 버튼·활성 탭·프로그레스에만 쓰이고 배경은 크림인지 확인.
- globals.css 또는 Arena 테마 변수가 bty-*.mdc 규칙(도메인/UI 분리)을 해치지 않는지 확인.
- 결과를 PASS/FAIL + 발견 이슈 목록으로 보고해줘.


- ProgressCard·클릭 가능 카드: hover 시 translateY(-2px), box-shadow 강화, transition 0.2s ease.
- 버튼: hover 시 brightness(1.05) 또는 scale(1.02), transition 0.15s.
- focus-visible 시 outline 대신 box-shadow 링 (접근성 유지).
```

### 3-2. 검증 (Cursor 2)

```
방금 진행 에이전트가 적용한 "호버·카드 인터랙션"을 검증해줘.

- 카드·버튼에 hover 시 시각적 변화(들어올림·그림자·scale 등)가 있는지, transition이 자연스러운지 확인.
- 포커스 링이 키보드 포커스 시 보이는지 확인.
- 결과를 PASS/FAIL + 발견 이슈 목록으로 보고해줘.
```

---

## 단계 4: 전체 통합 검증 (검증 에이전트만)

### 4-1. 검증 (Cursor 2)

```
지금까지 적용한 첫인상 디자인(히어로·폰트·악센트·호버)에 대해 통합 검증해줘.

- docs/DESIGN_FIRST_IMPRESSION_BRIEF.md 목표: "전문가 손길", "매일 쓰고 싶은 사이트" 첫인상에 부합하는지 요약.
- bty/(protected) 대시보드·Arena·리더보드·멘토: 규칙(bty-ui-render-only, arena-global) 위반 없이 UI만 렌더하는지 최종 확인.
- 결과를 PASS/FAIL + 개선 제안 1~2개(있으면)로 보고해줘.
```

---

## 사용 방법

| 순서 | Cursor 1 (진행) | Cursor 2 (검증) |
|------|------------------|------------------|
| 1 | 위 **1-1** 프롬프트 복사해 붙여 넣기 | (대기) |
| 2 | (대기) | 진행이 끝났다고 하면 **1-2** 프롬프트 복사해 붙여 넣기 |
| 3 | **2-1** 프롬프트 복사해 붙여 넣기 | (대기) |
| 4 | (대기) | **2-2** 검증 |
| 5 | **3-1** 진행 | (대기) |
| 6 | (대기) | **3-2** 검증 |
| 7 | — | **4-1** 통합 검증 |

**한 줄 지시 예시**
- 진행 에이전트: 「`docs/AGENTS_TURN_BY_TURN.md` 단계 1 진행 해줘.」
- 검증 에이전트: 「`docs/AGENTS_TURN_BY_TURN.md` 단계 1 검증 해줘.」

완료 후 NEXT_TASKS_2 §3-3·CURRENT_TASK 2차 표에서 「첫인상 디자인」 [x] 처리하면 됨.

---

## 단계 4 통합 검증 결과 (진행 에이전트 실행)

**검증 일자**: 2025-02 기준 적용분 점검.

### DESIGN_FIRST_IMPRESSION_BRIEF 목표 부합
- **"전문가 손길", "매일 쓰고 싶은 사이트"** — 히어로 한 문장·여백·포인트 폰트·악센트·호버·스켈레톤 로딩 적용됨. 목표 충족.

### 확인 항목
| 항목 | 상태 |
|------|------|
| 대시보드 히어로 최상단, "오늘도 한 걸음…" 1.75rem~2rem | ✅ |
| Arena(/bty-arena) 첫 화면 히어로 + 여백 | ✅ |
| 포인트 폰트(--font-arena-heading), 악센트(버튼·탭·프로그레스) | ✅ (globals.css §4 B·C) |
| 카드 호버 translateY(-2px) + box-shadow | ✅ (.bty-card:hover) |
| 버튼 호버 brightness/scale, focus-visible box-shadow 링 | ✅ |
| 로딩 시 카드형 스켈레톤 (대시보드·리더보드) | ✅ (CardSkeleton, LeaderboardListSkeleton) |
| bty-ui-render-only / arena-global | ✅ UI는 API 값 표시; 랭킹/XP 계산은 API·도메인. (대시보드에서 tierFromCoreXp는 코드명·로어 표시용으로만 사용.) |

### 결과
- **PASS**
- **개선 제안**: 없음. 추가로 원하면 빈 상태(empty state) 일러/문구 강화 가능.

### 후속 검증 (첫인상 디자인 통합)
- **결과**: PASS. 첫인상 디자인(히어로·폰트·악센트·호버)이 DESIGN_FIRST_IMPRESSION_BRIEF 목표에 맞고, bty/(protected) 대시보드·Arena·리더보드·멘토는 bty-ui-render-only·arena-global 관점에서 UI만 렌더하는 것으로 확인됨.
- **개선 제안 (선택)**: (1) 빈 상태 — BRIEF §2에 따라 데이터 없을 때 일러/아이콘 + 한 줄 문구 보강. (2) 리더보드 1등 강조 색 — `var(--dojo-purple)` → `var(--arena-accent)` 통일 적용함.
