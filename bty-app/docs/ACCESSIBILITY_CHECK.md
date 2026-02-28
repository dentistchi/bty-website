# 접근성·키보드 포커스 점검 (NEXT_TASKS_2 §3-1)

**범위**: bty/(protected) 대시보드·멘토·Arena·리더보드.

---

## 1. 점검 항목

| # | 항목 | 확인 방법 |
|---|------|-----------|
| 1 | **포커스 가능한 컨트롤** | Tab 키로 버튼·링크·입력창·셀렉트에 순서대로 도달 가능한지. |
| 2 | **포커스 시 보이는 스타일** | 포커스 시 outline/링크가 보이는지 (기본 브라우저 outline 또는 커스텀 focus-visible). |
| 3 | (선택) **aria-label·역할** | 스크린 리더용 레이블·역할이 필요한 컨트롤에 적용 여부. |

---

## 2. 적용한 보강 (코드)

- **globals.css**: `.bty-arena-area` 내 링크·버튼·input·select·tabindex 요소에 **:focus-visible** 스타일 추가.  
  - `outline: 2px solid var(--arena-accent); outline-offset: 2px;`  
  - 네비 링크(`.bty-nav-link`)와 공통 포커스 링크로 키보드 포커스 시 시인성 확보.

**대상 페이지**: 대시보드·멘토는 (protected) layout의 `.bty-arena-area`, 리더보드·Arena(bty-arena)는 ArenaLayoutShell의 `.bty-arena-area`로 동일 클래스 적용됨.

---

## 3. 페이지별 포커스 가능 요소 (참고)

| 페이지 | 포커스 가능 요소 |
|--------|------------------|
| **대시보드** | BtyTopNav(링크), Go to Arena / View Weekly Ranking 링크, Arena 가입 폼(select, input, button), 카드 내 링크·버튼, Elite 카드 링크 등. |
| **멘토** | BtyTopNav, 입력창·버튼, 링크. (멘토 페이지는 focus:ring 클래스 일부 적용됨.) |
| **Arena** | BtyTopNav, ArenaHeader 버튼, 시나리오 선택지(button), 리플렉션 입력·제출, 기타 버튼·링크. |
| **리더보드** | BtyTopNav. (리스트는 읽기 전용.) |

---

## 4. 발견 이슈 목록

테스트 후 이슈가 있으면 아래에 기입.

| # | 페이지 | 내용 | 심각도 |
|---|--------|------|--------|
| 1 | (없음) | — | — |

---

## 5. 실행 방법

- **로컬**: `npm run dev` 후 각 페이지에서 Tab 키로 이동, Shift+Tab으로 역순 이동.
- **포커스 링크**: 포커스 시 보라색 outline이 보이면 통과. 보이지 않으면 브라우저/전역 outline 제거 여부 확인.

*작성: NEXT_TASKS_2 §3-1.*
