# Design Token(방식 A) + Storybook 진행 과정 및 4 Cursor 핸드오프

**목적**: 지금까지의 과정을 서류화하고, **커맨더 포함 4개 Cursor**가 이어서 작업할 때 **누구에게 무엇을 명령할지** 복사용 프롬프트로 정리한다.

---

## 1. 지금까지의 과정 (서류화)

### 1.1 Design Token — 방식 A (수동 확장)

- **선택**: tokens.json 자동 생성 없이, **Tailwind + globals.css 수동 확장**으로 진행.
- **참고 문서**: `docs/BTY_ARENA_DESIGN_TOKEN_TAILWIND_APPLICABILITY.md` §7 요약, §9 수동 theme.extend 예시.

**적용된 파일**

| 파일 | 적용 내용 |
|------|-----------|
| **`src/app/globals.css`** | BTY Arena Design Token(방식 A) 블록 추가. `:root`(라이트) / `.dark`(다크)에 `--arena-*`, `--foundry-*`, `--center-*`, `--text-base`, `--text-light`, `--bg-base`, `--border-base` 등 정의. |
| **`tailwind.config.ts`** | `darkMode: ["class"]` 설정. `theme.extend.colors`에 **arena**, **center**, **neutral** (var 기반), **foundry**(기존 hex + 토큰 primary/accent/bg/text-primary/text-secondary), **dear**·**mentor**·**journey**·**dojo**·**sanctuary** 유지. |

**사용 예**

- `bg-arena-bg`, `text-arena-text-primary`, `bg-center-bg`, `text-neutral-textBase` 등.
- 다크 모드: 루트에 `class="dark"` 적용 시 `.dark` 변수 사용.

### 1.2 Storybook 설정 및 UI 스토리

- **경로**: `bty-app/.storybook/` (main.ts, preview.ts), `bty-app/stories/`, `bty-app/src/components/ui/`, `bty-app/src/lib/i18n/t.ts`.
- **구성**:
  - **Button**: tone(arena/foundry/center), variant(primary/secondary), size, loading, disabled. **캔버스 반응**으로 클릭 시 버튼 아래에 "클릭됨 N회" 표시.
  - **EmptyState**: tone별 스토리, i18n(title/desc/ctaLabel), CTA 클릭 시 console 로그.
- **i18n**: `t("arena.start_simulation", locale)` → "시뮬레이션 시작" / "Start Simulation".

---

## 2. Storybook 정상 동작 검증 기준

**아래가 모두 맞으면 Storybook이 의도한 대로 동작하는 상태입니다.**

| # | 확인 항목 | 기대 결과 |
|---|-----------|-----------|
| 1 | **버튼 아래 클릭 횟수** | "시뮬레이션 시작" 버튼 아래에 **「클릭됨 1회」「클릭됨 6회」** 등이 locale에 맞게 잘 나온다. (영어면 "Clicked N time(s)") |
| 2 | **버튼 클릭 시 숫자 증가** | 시뮬레이션 시작 버튼을 **누를 때마다** 숫자가 1씩 올라간다. |
| 3 | **Actions 탭** | **Actions** 탭에 **onClick** 이벤트가 기록된다. |

**검증 방법**

1. `bty-app`에서 `npm run storybook` 실행.
2. **ui/Button** → PrimaryArena(또는 아무 Button 스토리) 선택.
3. 버튼("시뮬레이션 시작") 여러 번 클릭 → 버튼 아래 "클릭됨 N회" 표시 확인.
4. 하단 **Actions** 패널에서 `onClick` 로그 확인.

**정상 판정**: 위 3항목 모두 충족 → **Storybook 쪽은 의도한 대로 동작.**

---

## 3. 4 Cursor 역할 및 복사용 프롬프트

### 3.1 역할 정리

| Cursor | 역할 | 담당 |
|--------|------|------|
| **커맨더 (당신)** | 지시·결정 | 이 문서·CURRENT_TASK·COMMANDER 백로그를 보고, 아래 프롬프트를 **복사해 해당 Cursor에 붙여 넣어** 명령. |
| **Cursor 1** | 진행 에이전트 | 구현·코드 수정. Center 페이지, Design Token 확장, 스토리 추가 등. |
| **Cursor 2** | 검증 에이전트 | Storybook 정상 동작 검증, 배포 전 체크, bty-release-gate 등. |
| **Cursor 3** | 진행 에이전트 | Cursor 1과 동일 또는 보조 구현. |
| **Cursor 4** | Arena 전용 | 코드네임·아바타·리더보드 등. `docs/ARENA_CODENAME_AVATAR_PLAN.md`, `docs/COMMANDER_CURSORS_REF.md` §1 참고. |

### 3.2 처음 지시할 때 (컨텍스트 부여)

**Cursor 1 또는 3 (진행용)** 에 처음 지시할 때:

```
docs/AGENTS_SHARED_README.md, docs/CURRENT_TASK.md 읽고, docs/DESIGN_TOKEN_AND_STORYBOOK_HANDOFF.md §2(Storybook 검증 기준) 알아 둔 뒤 아래 지시 따르면 돼.
```

**Cursor 2 (검증용)** 에 처음 지시할 때:

```
docs/AGENTS_SHARED_README.md, docs/NEXT_STEPS_RUNBOOK.md 읽고, docs/DESIGN_TOKEN_AND_STORYBOOK_HANDOFF.md §2(Storybook 검증 기준) 확인한 뒤 아래 지시 따르면 돼.
```

---

## 4. 누구에게 무엇을 명령할지 — 복사용 프롬프트

### 4.1 Storybook 정상 동작 검증 (Cursor 2)

```
docs/DESIGN_TOKEN_AND_STORYBOOK_HANDOFF.md §2 기준으로 Storybook이 의도한 대로 동작하는지 검증해줘.

- bty-app에서 npm run storybook 실행 후 ui/Button 스토리에서 "시뮬레이션 시작" 버튼 클릭 시 버튼 아래 "클릭됨 1회", "클릭됨 6회" 등이 나오는지, 클릭할 때마다 숫자가 올라가는지 확인.
- Actions 탭에 onClick 이벤트가 기록되는지 확인.
- 위 세 가지가 모두 맞으면 PASS, 하나라도 아니면 FAIL과 함께 어떤 항목이 실패했는지 보고해줘.
```

### 4.2 Design Token 방식 A 추가 확장 (Cursor 1 또는 3)

```
docs/BTY_ARENA_DESIGN_TOKEN_TAILWIND_APPLICABILITY.md §9와 tokens/source/tokens.json을 참고해서, 방식 A를 추가 확장해줘.

- tailwind.config.ts의 theme.extend에 fontSize(h1, h2, body, caption, button—lineHeight/fontWeight/letterSpacing), transitionDuration(fast, base, slow), transitionTimingFunction(standard) 추가.
- globals.css에 필요한 CSS 변수가 없으면 추가. 기존 arena/center/neutral/foundry 토큰은 유지.
- 변경 후에도 기존 UI(대시보드·Arena·Storybook Button/EmptyState)가 깨지지 않는지 확인해줘.
```

### 4.3 Center 페이지 개선 진행 (Cursor 1 또는 3)

```
docs/CENTER_PAGE_IMPROVEMENT_SPEC.md §9 우선순위대로 진행해줘.

- 1순위: CTA 통합 + 재로그인 버그 수정 (§5).
- 2순위: "챗으로 이어하기" 동작 수정 (§6).
- 도메인/API는 건드리지 말고, UI·라우팅·미들웨어만 수정. bty-release-gate·bty-auth-deploy-safety 규칙 준수.
- 변경 후 검증용 체크리스트(로그인 유지, CTA 클릭 시 재로그인 없음, 챗으로 이어하기 클릭 시 챗 열림)를 문서에 한 줄씩 추가해줘.
```

### 4.4 Arena 코드네임·아바타 (Cursor 4)

```
docs/ARENA_CODENAME_AVATAR_PLAN.md와 docs/COMMANDER_CURSORS_REF.md §1 Cursor 4 역할을 보고, 지금 단계에서 할 일을 진행해줘.

- 리더보드 아바타 역전 버그 확인·수정, 코드네임 "코드별 1회" 규칙, 캐릭터 고정+옷 선택 단계 중 미완료 항목부터.
- 결과와 다음 단계를 짧게 문서에 반영해줘.
```

### 4.5 배포 전 체크 (Cursor 2)

```
bty-release-gate 규칙에 맞게 배포 전 체크 실행해줘.

- docs/.cursor/rules/bty-release-gate.mdc의 A~F(쿠키/세션, 주간 리셋, 리더보드, 마이그레이션, API, 검증 단계)를 터치한 변경이 있으면 해당 항목 점검.
- 결과를 Release Gate Results: PASS/FAIL + Findings + Next steps 체크리스트 형식으로 보고해줘.
```

---

## 5. 한 줄 지시 예시 (복사용)

| 대상 | 한 줄 지시 |
|------|------------|
| **Cursor 2** | 「`docs/DESIGN_TOKEN_AND_STORYBOOK_HANDOFF.md` §2 기준으로 Storybook 정상 동작 검증해줘. 클릭됨 N회 표시 + Actions 탭 onClick 확인.」 |
| **Cursor 1** | 「`docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` §9 1순위(CTA 통합·재로그인 버그) 구현해줘.」 |
| **Cursor 3** | 「`docs/DESIGN_TOKEN_AND_STORYBOOK_HANDOFF.md` §4.2대로 Design Token 방식 A에 fontSize·transition 확장해줘.」 |
| **Cursor 4** | 「`docs/ARENA_CODENAME_AVATAR_PLAN.md` 현재 단계 진행해줘.」 |

---

**문서 위치**: `docs/DESIGN_TOKEN_AND_STORYBOOK_HANDOFF.md`  
**관련**: `docs/COMMANDER_CURSORS_REF.md`, `docs/COMMANDER_BACKLOG_AND_NEXT.md`, `docs/CURRENT_TASK.md`, `docs/BTY_ARENA_DESIGN_TOKEN_TAILWIND_APPLICABILITY.md`
