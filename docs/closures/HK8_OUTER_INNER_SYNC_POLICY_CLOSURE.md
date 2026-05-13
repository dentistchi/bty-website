# HK8-OUTER-INNER-SYNC-POLICY — Closure

**Sprint**: HK8-OUTER-INNER-SYNC-POLICY
**Closure date**: 2026-05-13
**Closure type**: Policy frame (Option D — 현 상태 유지 + 동기화 규약 명문화)
**Mutation scope**: docs only (이 파일 단일), 0 code changes
**Inventory depth**: Step 1–3 (Step 4 skipped)
**Long-standing backlog backup tag**: `backup/pre-hk8-outer-sync-20260511-062036` (commit `679d1f6`, 2026-05-11)
**Outer commit (at closure time)**: `2c1eb29` → (this closure adds 1 commit)

---

## 1. Context — Why this sprint

HK9 Sprint 1 (`HK9-CODENAME-SYNC C-β`, 2026-05-12) 및 Sprint 2 (`HK9-ORPHAN-DOCS B-β`, 2026-05-13) 진행 중, outer working tree에 5개의 modified/deleted entries (이하 "5 leaks")가 지속적으로 관측되었으나 closure dispatch가 inner repo touch를 금지한 상태로 정상 처리됨. 이 5 leaks의 정체와 outer-inner 관계 구조가 명시적으로 문서화되지 않은 상태였으며, 본 sprint는 그 구조를 inventory-first로 확정 후 정책으로 명문화함.

---

## 2. Inventory 결과 (측정값 only)

### Step 1 — Commit history scope

| Repo | Total commits | First commit | First date | Ahead/behind vs origin |
|---|---|---|---|---|
| outer | 548 | `076a060` | 2026-01-31 | (sync state 별도) |
| inner | 71 | `6934a7c3` | 2026-04-29 | 71 ahead / 530 behind origin |

- **Merge-base**: 없음 (outer와 inner 사이 공통 ancestor 없음)

### Step 2 — Outer-inner relationship mechanism

| 측정 항목 | 결과 |
|---|---|
| outer가 inner를 추적하는 방식 | 직접 파일 (mode `100644`), NOT submodule gitlink (mode `160000`) |
| `.gitmodules` 파일 | 없음 |
| inner `.git` 형태 | directory (standalone full `.git/`), NOT worktree pointer file |
| inner origin URL | `git@github.com:dentistchi/bty-website.git` |
| outer origin URL | `git@github.com:dentistchi/bty-website.git` (동일) |
| outer가 추적하는 `bty-app/` 파일 수 | 2524 |

→ **구조**: Submodule 아님, worktree 아님. Outer와 inner는 같은 working tree 파일들을 각자 독립적으로 추적하는 2개의 별개 standalone git repo이며, 같은 GitHub remote(`dentistchi/bty-website.git`)의 같은 branch(`main`)에 푸시함.

### Step 3 — Sync state + dual modal

- Outer HEAD = origin/main = `2c1eb29` (last fetch 시점 0 ahead / 0 behind)
- Outer modal: **dual** — sprint 진행 중에는 `bty-app/` 파일 직접 commit, sprint 종료 시에는 `docs/closures/` closure commit
- Inner modal: **atomic sub-commit** — 작은 단위 코드 commit

### 5 leaks 정체

| # | Status | Path | 출처 |
|---|---|---|---|
| 1 | M | `bty-app/src/features/my-page/logic/computeLeadershipState.ts` | Inner commit (HK9-CODENAME-SYNC C-β, `99da02d2`) |
| 2 | M | `bty-app/src/lib/bty/center/letterService.ts` | Inner commit (HK7-LLM-MIGRATION 3/4, `cb7512fd`) |
| 3 | M | `bty-app/src/lib/bty/identity/getMyPageIdentityState.ts` | Inner commit (HK6 canonical, pre-existing) |
| 4 | M | `bty-app/src/lib/bty/validator/layer2Semantic.ts` | Inner commit (HK7-LLM-MIGRATION 4/4, `a1dc742a`) |
| 5 | D | `bty-app/src/lib/llm.ts` | Inner commit (HK7-LLM-MIGRATION 4/4, `a1dc742a` — atomic deletion) |

→ 4 modifications + 1 deletion = 5 entries. 모두 inner-side implementation의 outer HEAD 미통합 상태.

---

## 3. Policy — 5조항 (verbatim, source-of-truth)

### 조항 1: Outer = canonical sprint closure repo

- **Scope**: docs/ closure, sprint 기록, 필요 시 bty-app/ 통합 commit
- **Modal**: sprint 진행 중 bty-app/ 직접 commit + sprint 종료 시 docs/ closure commit
- **Authority**: sprint closure 단계의 canonical 기록 주체

### 조항 2: Inner = atomic implementation repo

- **Scope**: 작은 단위 (atomic) 코드 commit
- **Modal**: feature/fix/refactor sub-commits
- **Push invariant**: HK8 sync policy 확정 전 금지 (본 closure 시점에서 sync policy = Option D, push policy는 별도 후속 sprint에서 결정 필요)

### 조항 3: Shared remote/branch 위험 명시

- Outer remote = Inner remote = `git@github.com:dentistchi/bty-website.git`
- 양쪽 모두 origin/main에 접근 가능
- 결과: inner push 후 outer는 stale origin/main 참조 보유 (fetch 전까지 미반영)
- Diverge risk: 동시 push 시 force-push 유혹 / conflict 가능

### 조항 4: 5 leaks = sync debt, NOT anomaly

- 정체: inner-side implementation이 outer HEAD에 미통합된 정상 표시
- 금지 행동: 삭제 / 복구 / `git checkout -- <file>` / `git restore` 등 5 leaks 제거 mutation
- 허용 해소 경로: outer pull (조항 5 gate 통과 후, 별도 sprint)

### 조항 5: 다음 mutation 전 필수 gate (4-check)

- (a) Outer fetch/pull 영향 검증 (실제 origin 상태 측정, dry-run 또는 ls-remote 우선)
- (b) Outer working tree 5 leaks 보존 확인
- (c) HK6 canonical file (`getMyPageIdentityState.ts`) 재변경 금지 검증
- (d) Explicit path staging만 허용 (`git add .` / `-A` 금지)

---

## 4. docs/closures/ 패턴 규약 (HK9 Sprint 1+2 도출)

본 closure doc은 docs/closures/ 패턴의 **세 번째 적용 사례**. 패턴 규약:

- Explicit path stage (`git add -A` / `git add .` 금지)
- Inner repo 진입 금지 (outer-only mutation)
- Verbatim commit message (Commander-provided)
- 3단 gate: Pre-commit verify → Pre-push verify → Post-push verify

### docs/closures/ 인벤토리 (closure 시점)

| 순서 | 파일 | Sprint | Date |
|---|---|---|---|
| 1 | `HK9_CODENAME_SYNC_CLOSURE.md` | HK9-CODENAME-SYNC C-β | 2026-05-12 |
| 2 | `HK9_ORPHAN_DOCS_CLOSURE.md` | HK9-ORPHAN-DOCS B-β | 2026-05-13 |
| 3 | `HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md` (this file) | HK8-OUTER-INNER-SYNC-POLICY | 2026-05-13 |

---

## 5. Self-application — 본 closure가 정책의 첫 적용

본 closure는 조항 1 (docs canonical) + 조항 5 (4-check gate) 의 첫 적용 사례. 자체 적용 결과:

| Invariant | 결과 |
|---|---|
| Mutation = outer-only, 1 file | ✅ (docs/closures/HK8_*.md 단일 add) |
| 5 leaks 보존 | ✅ (mutation 전후 동일) |
| HK6 canonical file 재변경 0 | ✅ (leak preservation only) |
| Explicit path staging | ✅ (specific path 지정) |
| Inner 변경 0 | ✅ |
| `bty-app/` 변경 0 | ✅ |

---

## 6. Gate 4-check 통과 기록 (Sprint 직전 수행)

| Gate | 측정 | Verdict |
|---|---|---|
| (a) Outer/origin sync | local HEAD = local origin/main = actual remote = `2c1eb29` | **ORIGIN_SYNC_OK** |
| (b) 5 leaks 보존 | 5/5 entries intact (4M + 1D) | **LEAKS_PRESERVED_OK** |
| (c) HK6 canonical 재변경 금지 | `getMyPageIdentityState.ts` = 4 inserts / 4 deletes vs HEAD (pre-existing leak only, Sprint mutation 0) | **HK6_FILE_STATUS = leak preserved** |
| (d) Explicit path staging 준비 | staged_count = 0 | **STAGING_CLEAN_OK** |

**4/4 PASS** → Mutation 진입 인증 부여됨.

---

## 7. Outcome + Backlog (HK8 종료 후 OPEN)

- ✅ HK8 정책 명문화 완료 (Option D — 현 상태 유지 + 동기화 규약 명시)
- ✅ docs/closures/ 패턴 세 번째 적용 사례 확립
- ✅ 본 closure 후 5 leaks 그대로 (조항 4 invariant 보존)
- ✅ Inner 영향 0 (outer-only mutation)

### Backlog (별도 sprint 후보)

| # | 항목 |
|---|---|
| 1 | 5 leaks 해소 sync sprint — outer pull 통한 inner 변경 통합 (조항 5 4-check 통과 필수) |
| 2 | Inner push policy 결정 sprint — 조항 2 push invariant 해제 조건 정의 |
| 3 | Memory line 11 update — remote URL 명시, diverge risk frame, behind 값 정성 |
| 4 | Memory line 17, 18 update — 5 outer leaks → sync debt 재정의 |
| 5 | `mockScenario.ts:275` STILLWATER deferred (Arena TopBar 별도 sprint) |
| 6 | Inner WIP HOLD clusters: C7, E3, F2, G5 |
| 7 | AL-2 backlog: HK 5 + FINGERPRINT_VERSION deferred |
| 8 | `discipline_dispatch` entry 압축 통합 (HK9 Sprint 1 C3 권한 경계 위반 + 본 HK8 premature authoring 통합) |

---

## 8. Closure invariants

- HK8 정책 = Option D = 현 상태 + 명문화, 구조 변경 없음
- 본 closure 후 5 leaks 그대로 (조항 4 invariant)
- Inner 영향 없음 (outer-only mutation)
- 외부 운영자 정책 회수 가능 형태로 명문 보존

---

## Discipline note

본 sprint는 Commander 명시 dispatch 절차 정착의 **세 번째 적용**:

| Sprint | 학습 적용 |
|---|---|
| HK9 Sprint 1 (CODENAME-SYNC C-β) | 미지시 외부 closure 사례 발견 |
| HK9 Sprint 2 (ORPHAN-DOCS B-β) | Commander 명시 dispatch 절차 정착 (Sprint 1 학습 적용) |
| HK8 (OUTER-INNER-SYNC-POLICY) | Commander 명시 dispatch + Gate 4-check + premature authoring abort + authoring 권한 명시 부여 (Sprint 1+2 학습 통합) |

HK8 sprint 진행 중 한 차례 C3가 mutation pre-fabrication 위험에 진입했으나 (verbatim 본문 없는 상태에서 mutation dispatch 수신), `discipline_no_premature_dispatch_authoring` memory를 적용하여 abort + Commander 인증 요청 → authoring 권한 명시 부여 → conversational draft 제출 단계로 정상 흐름 복귀.
