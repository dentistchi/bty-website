# BTY SPRINT PLAN

멀티 Cursor 스프린트 **타임라인·요약·역사** 문서.

**⚠️ TASK(할 일) 큐의 단일 진실은 이 파일이 아님.** **`docs/CURSOR_TASK_BOARD.md`의 "이번 런" 표**만 따른다. 본 문서는 보드와 **동기화용**이며, **불일치 시 보드가 우선.** Cursor는 **SPRINT_PLAN만 보고 OWNER별 `[ ]`를 추측하지 말 것.**

---

## 다른 Cursor가 할 일을 어디서 보나 (필독)

**C2·C3·C4·C5·C6 커서는 오직 본 파일 `docs/SPRINT_PLAN.md`만 연다.** **「C2~C6 할일」** = **구현 우선순위 5줄**(REFRESH) — **배포 전 검증 루틴으로 채우지 않는다**(검증은 배포 직전·Gate 태스크). **refresh** 시 에이전트가 이 블록을 갱신한다.

| 역할 | 보는 위치 |
|------|-----------|
| **C2~C6** | **먼저 보드**에 자기 OWNER **`[ ]` 있는지 확인** → 있으면 본 문서 **C2~C6 할일** 1~5 · **없으면 CONTINUE 중단**(아래 블록은 참고만) |
| **C1** | `CURSOR_TASK_BOARD.md` "이번 런" + 본 문서. 보드가 단일 진실. **REFRESH** 시에는 **`REFRESH_PROCEDURE.md`「C1 이중 의무」** — 자기 `[ ]` DOCS 처리와 **아래 C2~C6 블록 서류 갱신**을 **같은 절차**에서 수행. |

*보드에 자기 OWNER **`[ ]`가 없으면* (해당 이번 런에서 전부 [x]) → **CONTINUE는 그 역할에서 중단.** 다음 태스크는 **C1이 새 이번 런(S82 등)** 을 열 때 생김. **`SPRINT_PLAN`의 REFRESH 5줄은 참고·선택 준비일 뿐이며, 보드 `[ ]` 없으면 의무 작업 아님.** (예: **SPRINT 81** 에서 **C3는 TASK8·9 [x]** 이면 C3 할 일 없음 — 같은 런에 **`[ ]`는 C1 DOCS** 등만 남는 경우가 많음.)

---

## 범위

- 기능 백로그(Q3·Q4). **배포·Gate는 배포 시 1회.**
- 참조: `MVP_DEPLOYMENT_READINESS` + `bty-release-gate.mdc` A~F + `BTY_RELEASE_GATE_CHECK.md`.

---

## SPRINT 343 — **active (보드 SPRINT 137)**

- **현재 모드: 구현 단계** — C2~C6 할 일은 **코드 생성·구현** 우선; 검증은 보드 `[ ]` 태스크에서 수행.
- **[REFRESH (본 턴)]** S137/343 — **`PARALLEL_QUEUE_REFILL` §3** — S136 **`check-parallel-task-queue` exit 2** (**C4** 기아 — **C1·C5** 잔여) → **S137** · **TASK1~10** 전부 **`[ ]`** · **First** C5 **TASK1** (Gate **137**) · carry **`346/2528`** (C7 GATE · S136·Gate **136** 스냅 **346/2526**).
- **C7 (참고):** **`346/2528`** — Gate **137** 미실행.

| 워커 | S137 |
|------|-----|
| **C5** | **1·6 `[ ]`** |
| **C1** | **2·3·5·7 `[ ]`** |
| **C4** | **4 `[ ]`** *(dojo loading · foundry 직후 제외)* |
| **C3** | **8·9 `[ ]`** *(outcome meta edges · membership-request `submitted_at`)* |
| **C6** | **10 `[ ]`** |
| **C2** | C5 **TASK1**·IMPORT — Gate **137** `[ ]`

### C2~C6 할일 (REFRESH 시 갱신)

**S137 —** **TASK1~10 `[ ]`** · **First** C5 **TASK1** (Gate **137**) · **S136** 잔여 **C1·C5** 흡수.

#### C2 — Gatekeeper
1. **보드 S137** — C5 **TASK1 `[ ]`** — Gate **137** — **`origin/main` push** 후 `SPRINT_LOG`·문서 재동기.
2. **IMPORT_BOUNDARY** — `bty-layer-import` / domain 경계 **rg** 샘플 1회.
3. **API 계약** — S137 **TASK8·9** · **C3 `[ ]`**.
4. **Auth** 미터치 시 쿠키 문서 변경 없음.
5. **Gate** 스테일 시 `SPRINT_LOG` 한 줄.

**Notes (C2 · S343):** **CONTINUE 2026-03-21:** **`PARALLEL_QUEUE_REFILL`** — S136 **`exit 2`** (**C4**) → **S137** · **First** C5 **TASK1** (Gate **137**).

#### C3 — Domain
1. **보드 TASK8 `[ ]`** — **`arenaOutcomeMetaFromUnknown`** Symbol·bigint · Vitest.
2. **보드 TASK9 `[ ]`** — **`POST /api/arena/membership-request`** **`submitted_at_invalid`** · `route.test.ts`.
3. **domain**→`lib`/`app` **금지**.
4. **S104 TASK14** 후보 — **NEXT_BACKLOG**와 중복 확인.
5. barrel·export 확인.

**Notes (C3 · S343):** **CONTINUE 2026-03-21:** **TASK8·9 `[ ]`**.

#### C4 — UI
1. **보드 TASK4 `[ ]`** — **`/[locale]/bty/(protected)/dojo/loading`** · **`DojoRouteLoadingShell`** · **`bty.dojoSuspenseMainRegionAria`** (ko/en) · `npm run lint`.
2. 제외 목록 준수.
3. i18n **aria** 확인.
4. **S104 TASK15** 백로그 — 정합.
5. 터치 시 **Lint만**.

**Notes (C4 · S343):** **CONTINUE 2026-03-21:** TASK4 **`[ ]`**.

#### C5 — VERIFY
1. **보드 TASK1 `[ ]`** — Release Gate **137** A~F · `BTY_RELEASE_GATE_CHECK` · **C7** (실행 후 갱신).
2. **보드 TASK6 `[ ]`** — `ELITE_3RD` §3 · Gate **137**(TASK1) 동기.
3. 배포 직전이 아니면 Gate **일상 반복 안 함** (REFRESH 루틴 아님).
4. **Elite** 패치 후보 (비의무).
5. q237 **3/7** — TASK1과 동일 런에서 정합.

**Notes (C5 · S343):** **CONTINUE 2026-03-21:** **TASK1·6 `[ ]`** — **First** **TASK1** (Gate **137**).

#### C6 — VERIFY
1. **보드 TASK10 `[ ]`** — q237 **3/7** · **`self-healing-ci`** (실행 후 갱신) · `npm run lint` · Build ✓ (`rm -rf .next` 선행).
2. 실패 시 **Owner·한 줄** `SPRINT_LOG`.
3. C5 **TASK1**과 spot 중복만 조정.
4. REFRESH로 전체 스모크 **반복 안 함** (보드 태스크에서만).
5. **S136**에서 **TASK10** **`[x]`** 완료 — **S137** 새 **`[ ]`**.

**Notes (C6 · S343):** **CONTINUE 2026-03-21:** TASK10 **`[ ]`** — carry **`346/2528`** (C7 최신) · Gate **137** 실행 후 갱신.

### C1 Commander — REFRESH snapshot

| 항목 | 내용 |
|------|------|
| **이번 런** | **SPRINT 137** · **343** |
| **C1 잔여** | **TASK2·3·5·7 `[ ]`** (DOCS) — **S136** 흡수 |
| **C5 잔여** | **TASK6 `[ ]`** — **S136** 흡수 |
| **다음 스텝 (CONTINUE 2026-03-21)** | **First** C5 **TASK1** (Gate **137**) · 이후 **C1 TASK2** (`NEXT_PHASE`·`NEXT_BACKLOG` **S137/343**) |
| **병렬** | **TASK1~10 `[ ]`** · **First** C5 **TASK1** |
| **C7** | **`346/2528`** — Gate **137** 미실행 |
| **다음 C1** | **TASK2** — Gate **137** PASS 후 |

- **PARALLEL_QUEUE_REFILL (2026-03-21):** S136 **`check-parallel-task-queue` exit 2** (**C4**) → **S137** 오픈 · `SPRINT_PLAN`·`NEXT_PHASE`·`NEXT_BACKLOG`·`AUTO4`·`AI_TASK_BOARD`·`CURRENT_TASK` 동기.

---

## SPRINT 342 — **archived (보드 SPRINT 136)**

- **요약:** **TASK1·4·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7 `[ ]`** · **C5 TASK6 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S137** · **`346/2526`** (Gate **136** · C7).
- **C7:** **346/2526** — Gate **136** (TASK1) ✓.

| 워커 | S136 (마감) |
|------|-----|
| **C5** | **1 `[x]`** · **6 `[ ]`** → **S137** |
| **C1** | **2·3·5·7 `[ ]`** → **S137** |
| **C4** | **4 `[x]`** *(foundry loading)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[x]`** |
| **C2** | C5 **TASK1**·IMPORT — Gate **136** **`[x]`** |

---

## SPRINT 341 — **archived (보드 SPRINT 135)**

- **요약:** **TASK1·4·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7 `[ ]`** · **C5 TASK6 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S136** · **`346/2524`** (Gate **135** · C7).
- **C7:** **346/2524** — Gate **135** (TASK1) ✓.

| 워커 | S135 (마감) |
|------|-----|
| **C5** | **1 `[x]`** · **6 `[ ]`** → **S136** |
| **C1** | **2·3·5·7 `[ ]`** → **S136** |
| **C4** | **4 `[x]`** *(dashboard loading)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[x]`** |
| **C2** | C5 **TASK1**·IMPORT — Gate **135** **`[x]`** |

---

## SPRINT 340 — **archived (보드 SPRINT 134)**

- **요약:** **TASK1·2·8·9·10 `[x]`** · 잔여 **C1 TASK3·5·7 `[ ]`** · **C4 TASK4 `[ ]`** · **C5 TASK6 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S135** · **`346/2522`** (Gate **134** · C7).
- **C7:** **346/2522** — Gate **134** (TASK1) ✓.

| 워커 | S134 (마감) |
|------|-----|
| **C5** | **1 `[x]`** · **6 `[ ]`** → **S135** |
| **C1** | **2 `[x]`** · **3·5·7 `[ ]`** → **S135** |
| **C4** | **4 `[ ]`** *(dashboard loading)* → **S135** |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[x]`** |
| **C2** | C5 **TASK1**·IMPORT — Gate **134** **`[x]`** |

---

## SPRINT 339 — **archived (보드 SPRINT 133)**

- **요약:** **TASK1·4·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7 `[ ]`** · **C5 TASK6 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S134** · **`346/2520`** (Gate **133** · C7).
- **C7:** **346/2520** — Gate **133** (TASK1) ✓.

| 워커 | S133 (마감) |
|------|-----|
| **C5** | **1 `[x]`** · **6 `[ ]`** → **S134** |
| **C1** | **2·3·5·7 `[ ]`** → **S134** |
| **C4** | **4 `[x]`** *(healing loading · integrity 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[x]`** |
| **C2** | C5 **TASK1**·IMPORT — Gate **133** **`[x]`** |

---

## SPRINT 338 — **archived (보드 SPRINT 132)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S133** · **`346/2520`** (Gate **132** · C7).
- **C7:** **346/2520** — Gate **132** (TASK1) ✓.

| 워커 | S132 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** → **S133** |
| **C1** | **2·3·5·7 `[ ]`** → **S133** |
| **C4** | **4 `[x]`** *(integrity loading · elite 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[x]`** |
| **C2** | C5 **TASK1**·IMPORT — Gate **132** **`[x]`** |

---

## SPRINT 337 — **archived (보드 SPRINT 131)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S132** · **`346/2516`** (Gate **131** · C7).
- **C7:** **346/2516** — Gate **131** (TASK1) ✓.

| 워커 | S131 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** → **S132** |
| **C1** | **2·3·5·7 `[ ]`** → **S132** |
| **C4** | **4 `[x]`** *(elite loading · mentor 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[x]`** |
| **C2** | C5 **TASK1**·IMPORT — Gate **131** **`[x]`** |

---

## SPRINT 336 — **archived (보드 SPRINT 130)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S131** · **`346/2516`** (Gate **130** · C7).
- **C7:** **346/2516** — Gate **130** (TASK1) ✓.

| 워커 | S130 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** → **S131** |
| **C1** | **2·3·5·7 `[ ]`** → **S131** |
| **C4** | **4 `[x]`** *(mentor loading · profile 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[x]`** |
| **C2** | C5 **TASK1**·IMPORT — Gate **130** **`[x]`** |

---

## SPRINT 335 — **archived (보드 SPRINT 129)**

- **요약:** **TASK4·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C5 TASK1·6 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S130** · **`346/2514`** (C7 스냅) · C7 **`346/2512`** (C6 TASK10 완료).
- **C7:** **346/2514** (S129 C7 baseline) · **346/2512** (C6 TASK10 `self-healing-ci`) — superseded by **S130** Gate **130** · **`346/2516`** ✓.

| 워커 | S129 (마감) |
|------|-----|
| **C5** | **1·6 `[ ]`** → **S130** |
| **C1** | **2·3·5·7 `[ ]`** → **S130** |
| **C4** | **4 `[x]`** *(profile loading · dojo 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[x]`** |
| **C2** | C5 **TASK1**·IMPORT — Gate **129** `[ ]` |

---

## SPRINT 334 — **archived (보드 SPRINT 128)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S129** · Gate **128** TASK1·6 **`[x]`** · **346/2511** (C7) · **C7** **`346/2511`** (`self-healing-ci` Gate **128**).
- **C7:** **346/2511** ✓ (S128 마감 스냅) — superseded by Gate **129** (carry **`346/2514`** · C5 **TASK1·6** **`[x]`**).

| 워커 | S128 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** |
| **C1** | **2·3·5·7 `[ ]`** → **S129** |
| **C4** | **4 `[x]`** *(dojo loading · dashboard 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[ ]`** → **S129** |
| **C2** | C5 **TASK1**·IMPORT — Gate **128** PASS ✓ |

---

## SPRINT 333 — **archived (보드 SPRINT 127)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S128** · Gate **127** TASK1·6 **`[x]`** · **346/2510** (C7) · **C7** **`346/2510`** (`self-healing-ci` Gate **127**).
- **C7:** **346/2510** ✓ (S127 마감 스냅) — superseded by Gate **128** (미실행).

| 워커 | S127 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** |
| **C1** | **2·3·5·7 `[ ]`** → **S128** |
| **C4** | **4 `[x]`** *(dashboard loading · healing 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[ ]`** → **S128** |
| **C2** | C1 **TASK2**·IMPORT — Gate **127** PASS ✓ |

---

## SPRINT 332 — **archived (보드 SPRINT 126)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S127** · Gate **126** TASK1·6 **`[x]`** · **346/2508** (C7) · **C7** **`346/2508`** (`self-healing-ci` Gate **126**).
- **C7:** **346/2508** ✓ (S126 마감 스냅) — superseded by Gate **127** **`346/2510`** ✓.

| 워커 | S126 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** |
| **C1** | **2·3·5·7 `[ ]`** → **S127** |
| **C4** | **4 `[x]`** *(healing loading · integrity 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[ ]`** → **S127** |
| **C2** | C1 **TASK2**·IMPORT — Gate **126** PASS ✓ |

---

## SPRINT 331 — **archived (보드 SPRINT 125)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S126** · Gate **125** TASK1·6 **`[x]`** · **346/2506** (Gate) · **C7** **`346/2506`** (`self-healing-ci` 최신).
- **C7:** **346/2506** ✓ (S125 마감 스냅) — superseded by Gate **126** **`346/2508`** ✓.

| 워커 | S125 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** |
| **C1** | **2·3·5·7 `[ ]`** → **S126** |
| **C4** | **4 `[x]`** *(integrity loading · elite 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[ ]`** → **S126** |
| **C2** | C1 **TASK2**·IMPORT — Gate **125** PASS ✓ |

---

## SPRINT 330 — **archived (보드 SPRINT 124)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S125** · Gate **124** TASK1·6 **`[x]`** · **346/2504** (Gate) · **C7** **`346/2504`** (`self-healing-ci` 최신).
- **C7:** **346/2504** ✓ (S124 마감 스냅) — superseded by Gate **125** **`346/2506`** ✓.

| 워커 | S124 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** |
| **C1** | **2·3·5·7 `[ ]`** → **S125** |
| **C4** | **4 `[x]`** *(elite loading · foundry 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[ ]`** → **S125** |
| **C2** | C1 **TASK2**·IMPORT — Gate **124** PASS ✓ |

---

## SPRINT 329 — **archived (보드 SPRINT 123)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S124** · Gate **123** TASK1·6 **`[x]`** · **346/2502** (Gate) · **C7** **`346/2502`** (`self-healing-ci` 최신).
- **C7:** **346/2502** ✓ (S123 마감 스냅) — superseded by Gate **124** **`346/2504`** ✓.

| 워커 | S123 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** |
| **C1** | **2·3·5·7 `[ ]`** → **S124** |
| **C4** | **4 `[x]`** *(foundry hub loading · mentor 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[ ]`** → **S124** |
| **C2** | C1 **TASK2**·IMPORT — Gate **123** PASS ✓ |

---

## SPRINT 328 — **archived (보드 SPRINT 122)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S123** · Gate **122** TASK1·6 **`[x]`** · **346/2500** (Gate) · **C7** **`346/2500`** (`self-healing-ci` 최신).
- **C7:** **346/2500** ✓ (S122 마감 스냅) — superseded by Gate **123** **`346/2502`**.

| 워커 | S122 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** |
| **C1** | **2·3·5·7 `[ ]`** → **S123** |
| **C4** | **4 `[x]`** *(mentor loading · profile 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[ ]`** → **S123** |
| **C2** | C1 **TASK2**·IMPORT — Gate **122** PASS ✓ |

---

## SPRINT 327 — **archived (보드 SPRINT 121)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S122** · Gate **121** TASK1·6 **`[x]`** · **346/2497** (Gate) · **C7** **`346/2497`** (`self-healing-ci` 최신).
- **C7:** **346/2497** ✓ (S121 마감 스냅) — superseded by Gate **122** **`346/2500`**.

| 워커 | S121 (마감) |
|------|-----|
| **C5** | **1·6 `[x]`** |
| **C1** | **2·3·5·7 `[ ]`** → **S122** |
| **C4** | **4 `[x]`** *(profile loading · dojo 직후 제외)* |
| **C3** | **8·9 `[x]`** |
| **C6** | **10 `[ ]`** → **S122** |
| **C2** | C1 **TASK2**·IMPORT — Gate **121** PASS ✓ |

---

## SPRINT 326 — **archived (보드 SPRINT 120)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S121** · Gate **120** TASK1·6 **`[x]`** · **346/2494** (Gate) · **C7** **`346/2494`** (`self-healing-ci` 최신).
- **C7:** **346/2494** ✓ (S120 마감 스냅) — superseded by Gate **121** **`346/2497`**.

| 워커 | S120 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S121)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **`[ ]`** *(→ S121 TASK10)* |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 325 — **archived (보드 SPRINT 119)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S120** · Gate **119** TASK1·6 **`[x]`** · **346/2493** (Gate) · **C7** **`346/2493`** (`self-healing-ci` 최신).
- **C7:** **346/2493** ✓ (S119 마감 스냅) — Gate **120** 미실행.

| 워커 | S119 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S120)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **`[ ]`** *(→ S120 TASK10)* |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 324 — **archived (보드 SPRINT 118)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S119** · Gate **118** TASK1·6 **`[x]`** · **346/2492** (Gate) · **C7** **`346/2492`** (`self-healing-ci` 최신).
- **C7:** **346/2492** ✓ (S118 마감 스냅) — Gate **119** 미실행.

| 워커 | S118 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S119)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **`[ ]`** *(→ S119 TASK10)* |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 323 — **archived (보드 SPRINT 117)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S118** · Gate **117** TASK1·6 **`[x]`** · **346/2489** (Gate) · **C7** **`346/2490`** (`self-healing-ci` 최신).
- **C7:** **346/2490** ✓ (S117 마감 스냅) — Gate **118** 미실행.

| 워커 | S117 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S118)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **`[ ]`** *(→ S118 TASK10)* |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 322 — **archived (보드 SPRINT 116)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S117** · Gate **116** TASK1·6 **`[x]`** · **346/2487** (Gate 로그) · **C7** **`346/2488`** (`self-healing-ci` 최신).
- **C7:** **346/2488** ✓ (S116 마감 스냅) — Gate **117** 미실행.

| 워커 | S116 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S117)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **`[ ]`** *(→ S117 TASK10)* |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 321 — **archived (보드 SPRINT 115)**

- **요약:** **TASK1·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C4 TASK4**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S116** · Gate **115** TASK1·6 **`[x]`** · **346/2486** carry.
- **C7:** **346/2486** ✓ (S115).

| 워커 | S115 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S116)* |
| **C4** | 4 **`[ ]`** *(→ S116 TASK4)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **`[ ]`** *(→ S116 TASK10)* |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 320 — **archived (보드 SPRINT 114)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S115** · Gate **114** TASK1·6 **`[x]`** · **346/2484** carry.
- **C7:** **346/2484** ✓ (S114).

| 워커 | S114 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S115)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 319 — **archived (보드 SPRINT 113)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S114** · Gate **113** TASK1·6 **`[x]`** · **346/2482** carry.
- **C7:** **346/2482** ✓ (S113).

| 워커 | S113 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S114)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 318 — **archived (보드 SPRINT 112)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S113** · Gate **112** TASK1·6 **`[x]`** · **346/2480** carry.
- **C7:** **346/2480** ✓ (S112).

| 워커 | S112 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S113)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 317 — **archived (보드 SPRINT 111)**

- **요약:** **TASK1·4·6·8·9 `[x]`** · 잔여 **C1 TASK2·3·5·7**·**C6 TASK10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S112** · Gate **111** TASK1·6 **`[x]`** · **346/2478** carry.
- **C7:** **346/2478** ✓ (S111).

| 워커 | S111 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S112)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **`[ ]`** *(→ S112 TASK10)* |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 316 — **archived (보드 SPRINT 110)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7** · **`PARALLEL_QUEUE_REFILL` → S111** · Gate **110** TASK1·6 **`[x]`** · **346/2476** carry.
- **C7:** **346/2476** ✓ (S110).

| 워커 | S110 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S111)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 315 — **archived (보드 SPRINT 109)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7** · **`PARALLEL_QUEUE_REFILL` → S110** · Gate **109** TASK1·6 **`[x]`** · **346/2474** carry.
- **C7:** **346/2474** ✓ (S109).

| 워커 | S109 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S110)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 314 — **archived (보드 SPRINT 108)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7** · **`PARALLEL_QUEUE_REFILL` → S109** · Gate **108** TASK1·6 **`[x]`** · **346/2472** carry.
- **C7:** **346/2472** ✓ (S108).

| 워커 | S108 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S109)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 313 — **archived (보드 SPRINT 107)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7** · **`PARALLEL_QUEUE_REFILL` → S108** · Gate **107** TASK1·6 **`[x]`** · **346/2470** carry.
- **C7:** **346/2470** ✓ (S107).

| 워커 | S107 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S108)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 312 — **archived (보드 SPRINT 106)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7** · **`PARALLEL_QUEUE_REFILL` → S107** · Gate **106** TASK1·6 **`[x]`** · **346/2468** carry.
- **C7:** **346/2468** ✓ (S106).

| 워커 | S106 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S107)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 311 — **archived (보드 SPRINT 105)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1 TASK2·3·5·7** · **`PARALLEL_QUEUE_REFILL` → S106** · Gate **105** TASK1·6 **`[x]`** · **346/2464** carry.
- **C7:** **346/2464** ✓ (S105).

| 워커 | S105 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S106)* |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 310 — **archived (보드 SPRINT 104)**

- **요약:** **TASK1·2·4·8·9·10·11·12·13 `[x]`** · 잔여 **C1 TASK3·5·7 · C5 TASK6 · C3 TASK14 · C4 TASK15** · **`PARALLEL_QUEUE_REFILL` → S105** · Gate **104** TASK1 **`[x]`** · **346/2464** carry.
- **C7:** **346/2464** ✓ (S104).

| 워커 | S104 (마감) |
|------|------------|
| **C5** | 1 **[x]** · 6 **`[ ]`** |
| **C1** | 2 **[x]** · 3·5·7 **`[ ]`** |
| **C4** | 4·11 **[x]** · 15 **`[ ]`** |
| **C3** | 8·9·12 **[x]** · 14 **`[ ]`** |
| **C6** | 10·13 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 309 — **archived (보드 SPRINT 103)**

- **요약:** **TASK2·4·8·9 `[x]`** · 잔여 **TASK1·3·5·6·7·10 `[ ]`** · **`PARALLEL_QUEUE_REFILL` → S104** · Gate **103** 미완 · **346/2456** carry.
- **C7:** carry **346/2456** (S102) — Gate **103** 미반영.

| 워커 | S103 (마감) |
|------|------------|
| **C5** | 1·6 **`[ ]`** *(미완)* |
| **C1** | 2·3·5·7 **`[ ]`** *(→ S104 DOCS 재개)* |
| **C4** | 4 **[x]** *(elite loading)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **`[ ]`** *(미완)* |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 308 — **archived (보드 SPRINT 102)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1** · **`PARALLEL_QUEUE_REFILL` → S103** · **346/2456** ✓.
- **C7:** **346/2456** ✓.

| 워커 | S102 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[ ]** *(→ S103 DOCS 재개)* |
| **C4** | 4 **[x]** *(dojo loading)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 307 — **archived (보드 SPRINT 101)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1** · **`PARALLEL_QUEUE_REFILL` → S102** · **346/2453** ✓.
- **C7:** **346/2453** ✓.

| 워커 | S101 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[ ]** *(→ S102 DOCS 재개)* |
| **C4** | 4 **[x]** *(locale root loading)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 306 — **archived (보드 SPRINT 100)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1** · **`PARALLEL_QUEUE_REFILL` → S101** · **346/2449** ✓.
- **C7:** **346/2449** ✓.

| 워커 | S100 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[ ]** *(→ S101 DOCS 재개)* |
| **C4** | 4 **[x]** *(bty-arena beginner loading)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 305 — **archived (보드 SPRINT 99)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1** · **`PARALLEL_QUEUE_REFILL` → S100** · **346/2445** ✓.
- **C7:** **346/2445** ✓.

| 워커 | S99 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[ ]** *(→ S100 DOCS 재개)* |
| **C4** | 4 **[x]** *(bty-arena root loading)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 304 — **archived (보드 SPRINT 98)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1** · **`PARALLEL_QUEUE_REFILL` → S99** · **346/2438** ✓.
- **C7:** **346/2438** ✓.

| 워커 | S98 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[ ]** *(→ S99 DOCS 재개)* |
| **C4** | 4 **[x]** *(assessment loading)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 303 — **archived (보드 SPRINT 97)**

- **요약:** **TASK1·4·6·8·9·10 `[x]`** · 잔여 **C1** · **`PARALLEL_QUEUE_REFILL` → S98** · **346/2436** ✓.
- **C7:** **346/2436** ✓.

| 워커 | S97 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[ ]** *(→ S98 DOCS 재개)* |
| **C4** | 4 **[x]** *(growth loading)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 302 — **archived (보드 SPRINT 96)**

- **요약:** **TASK1·6·8·9·10 `[x]`** · 잔여 **C1·C4** · **`PARALLEL_QUEUE_REFILL` → S97** · **346/2435** ✓.
- **C7:** **346/2435** ✓.

| 워커 | S96 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[ ]** *(→ S97 DOCS 재개)* |
| **C4** | 4 **[x]** *(center loading 완료 → S97 **TASK4**는 **growth** 신규)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 301 — **archived (보드 SPRINT 95)**

- **요약:** **TASK1·6·8·9·10 `[x]`** · 잔여 **C1·C4** · **`PARALLEL_QUEUE_REFILL` → S96** · **346/2433** ✓.
- **C7:** **346/2433** ✓.

| 워커 | S95 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[ ]** *(아카이브 잔여 → S96 DOCS에서 재개)* |
| **C4** | 4 **[ ]** *(dear-me 미완 → S96 TASK4는 **center** 경로로 신규)* |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 300 — **archived (보드 SPRINT 94)**

- **요약:** **TASK1~22 `[x]`** · **346/2431** ✓ · **loading/a11y·Arena edges·Gate 94** → **S95**.
- **C7:** **346/2431** ✓.

| 워커 | S94 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[x]** |
| **C4** | 4·12·14·15·18·22 **[x]** |
| **C3** | 8·9·11·16·19 **[x]** |
| **C6** | 10·13·17·20·21 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |


---

## SPRINT 299 — **archived (보드 SPRINT 93)**

- **요약:** **31/31 `[x]`** · **346/2425** ✓ · **loading/a11y 큐** · **Arena `*FromUnknown`·route edges** · **Gate 93** → **S94**.
- **C7:** **346/2425** ✓.

| 워커 | S93 (마감) |
|------|------------|
| **C5** | 1·6·18·23·27·31 **[x]** |
| **C1** | 2·3·5·7 **[x]** |
| **C4** | 4·12·16·21·30 **[x]** |
| **C3** | 8·9·11·14·15·19·20·24·26·29 **[x]** |
| **C6** | 10·13·17·22·25·28 **[x]** |
| **C2** | C5 TASK1 후 push Gate 동기 |

---

## SPRINT 298 — **archived (보드 SPRINT 92)**

- **요약:** **beginner `loading` `<main>`** · **description-lines**·**iso-ts** edges · **beginner-complete**·**interpretation** · **197·198차** · **Elite §3** · **346/2397** · **12/12** → **S93**.
- **C7:** **346/2397** ✓.

| 워커 | S92 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[x]** |
| **C4** | 4 **[x]** |
| **C3** | 8·9·11·12 **[x]** |
| **C6** | 10 **[x]** |

---

## SPRINT 297 — **archived (보드 SPRINT 91)**

- **요약:** **bty-arena/loading** `<main>` · **copy-fields**·**system-message** edges · **`POST /api/arena/event`** domain **400** · **195·196차** · **Elite §3** · **346/2387** · **10/10** → **S92**.
- **C7:** **346/2387** ✓.

| 워커 | S91 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[x]** |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |

---

## SPRINT 296 — **archived (보드 SPRINT 90)**

- **요약:** **`elite/loading`** · **`reflect`** `levelId` **S1** · **`arenaCodeNameFromUnknown`** whitespace edges · **346/2381** · **11/11** → **S91**.
- **C7:** **346/2381** ✓.

| 워커 | S90 (마감) |
|------|------------|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[x]** |
| **C4** | 4 **[x]** |
| **C3** | 8·9·11 **[x]** |
| **C6** | 10 **[x]** |

---

## SPRINT 294 — **archived (보드 SPRINT 88)**

- **요약:** dear-me **loading** · free-response **domain** · mission-choice **edges** · **344/2356** · **10/10** → **S89**.
- **C7:** **344/2356** ✓.

| 워커 | S88 |
|------|-----|
| **C5** | 1·6 **[x]** |
| **C1** | 2·3·5·7 **[x]** |
| **C4** | 4 **[x]** |
| **C3** | 8·9 **[x]** |
| **C6** | 10 **[x]** |

---

## SPRINT 293 — **archived (보드 SPRINT 87)**

- **요약:** C3~C6·C5·C4 구현 완료 · C1 DOCS 마감 **`[x]`** · **10/10** → **splint → S88**.
- **C7:** **344/2351** ✓.

| 워커 | S87 (마감 스냅샷) |
|------|-------------------|
| **C5** | TASK1·6 **[x]** |
| **C1** | TASK2·3·5·7 **[x]** |
| **C4** | TASK4 **[x]** |
| **C3** | TASK8·9 **[x]** |
| **C6** | TASK10 **[x]** |
| **C2** | push 시 Gate 동기 (표 밖) |

---

## SPRINT 292 — **archived (보드 SPRINT 86)**

- **요약:** S86에서 **C3·C4·C5·C6** **전부 [x]** · **C1 DOCS만 `[ ]`** → **exit 2** → **S87** (`PARALLEL_QUEUE_REFILL` §3 · 2026-03-20).
- **C7:** **342/2338** ✓.

| 워커 | S86 (마감 스냅샷) |
|------|-------------------|
| **C5** | TASK1·6 **[x]** |
| **C1** | TASK2·3·5·7 **[ ]** |
| **C4** | TASK4 **[x]** |
| **C3** | TASK8·9 **[x]** |
| **C6** | TASK10 **[x]** |
| **C2** | push 시 Gate 동기 (표 밖) |

---

## SPRINT 291 — **archived (보드 SPRINT 85)**

- **요약:** S85에서 **C3·C4·C5** 열 **전부 [x]** · **C1·C6** **`[ ]` 잔여** → **exit 2** → **S86** (`PARALLEL_QUEUE_REFILL` §3 · 2026-03-20).
- **C7:** **341/2335** ✓.

| 워커 | S85 (마감 스냅샷) |
|------|-------------------|
| **C5** | TASK1·6 **[x]** |
| **C1** | TASK2·3·5·7 **[ ]** |
| **C4** | TASK4 **[x]** |
| **C3** | TASK8·9 **[x]** |
| **C6** | TASK10 **[ ]** |
| **C2** | push 시 Gate 동기 (표 밖) |

---

## SPRINT 290 — **archived (보드 SPRINT 84)**

- **요약:** S84 미완료 중 **C3 표시 행 전부 [x]** · C1·C4·C5·C6 **`[ ]` 잔여** → **exit 2** → **S85** (`PARALLEL_QUEUE_REFILL` §3 · 2026-03-20).
- **C7:** **339/2327** ✓.

| 워커 | S84 (마감 스냅샷) |
|------|-------------------|
| **C5** | TASK1 [x] · TASK6 + 큐 보충 **[ ]** |
| **C1** | TASK2·3·5·7 **[ ]** |
| **C4** | TASK4 [x] · TASK11 **[ ]** |
| **C3** | TASK8·9 **[x]** |
| **C6** | TASK10 [x] · TASK12 **[ ]** |

### C5 — UI ENGINEER (289)

- [x] **TASK 1** [VERIFY] Release Gate Foundry **83**차 — **329/2293** ✓ · `BTY_RELEASE_GATE_CHECK` · Build ✓ (`rm -rf .next` 선행).
- [x] **TASK 6** [VERIFY] 엘리트 3차 §3 — §2 6항목 스팟 **PASS** · `ELITE_3RD` **329/2293** · TASK1 동기.
- [x] **TASK 14** (큐 보충 C5) — Gate·엘리트·문서 스테일 · **`BTY_RELEASE_GATE_CHECK`**·**`ELITE_3RD`** · **330/2297** ✓.
- [x] **TASK 18** (큐 보충 C5) — Gate·엘리트·문서 스테일 · **`BTY_RELEASE_GATE_CHECK`**·**`ELITE_3RD`** · **331/2300** ✓.
- [x] **TASK 21** (큐 보충 C5) — Gate·엘리트·문서 스테일 · **`BTY_RELEASE_GATE_CHECK`**·**`ELITE_3RD`** · **331/2300** ✓.
- [x] **TASK 23** (큐 보충 C5) — **`wireframe` `</main>`** · **`BTY_RELEASE_GATE_CHECK`**·**`ELITE_3RD`** · **332/2304** ✓.
- [x] **TASK 27** (큐 보충 C5) — Gate·엘리트·문서 · **`BTY_RELEASE_GATE_CHECK`**·**`ELITE_3RD`** · **334/2311** ✓.
- [x] **TASK 32** (큐 보충 C5) — Gate·엘리트·문서 · **`BTY_RELEASE_GATE_CHECK`**·**`ELITE_3RD`** · **335/2315** ✓.
- [x] **TASK 36** (큐 보충 C5) — Gate·엘리트·문서 · **`BTY_RELEASE_GATE_CHECK`**·**`ELITE_3RD`** · **336/2317** ✓.
- [x] **TASK 41** (큐 보충 C5) — Gate·엘리트·문서 · **`BTY_RELEASE_GATE_CHECK`**·**`ELITE_3RD`** · **340/2331** ✓ · `rm -rf .next` 선행 · **C5 `[ ]` 기아 방지 닫힘**.

**Notes:** **CONTINUE(C5) 2026-03-20:** TASK1·6·14·18·21·23·27·32·36·**41 [x]** · **`SPRINT_PLAN` C5 — UI ENGINEER (289) 미체크 없음** · 다음 C5 할 일 = 보드 **SPRINT 85** **C5 — VERIFY** 참조(본 역할 섹션 아님).

### C6 — TESTFIX ENGINEER (289)

- [x] **TASK 10** — `test:q237-smoke` **3 files / 7 tests** ✓ · `self-healing-ci.sh` **327 / 2287** ✓ · Build ✓ (`rm -rf .next` 선행) · **`SPRINT_LOG`**.
- [x] **TASK 12** (큐 보충) — `test:q237-smoke` + `self-healing-ci.sh` · **`SPRINT_LOG`** · **330/2297** ✓.
- [x] **TASK 17** (큐 보충) — q237-smoke **3 files / 7 tests** ✓ · `self-healing-ci.sh` **330 / 2297** ✓ · Build ✓ (`rm -rf .next` 선행) · **`SPRINT_LOG`** · TASK12 후속.
- [x] **TASK 20** (큐 보충) — q237-smoke **3 files / 7 tests** ✓ · `self-healing-ci.sh` **332 / 2304** ✓ · Build ✓ (`rm -rf .next` 선행) · **`SPRINT_LOG`** · TASK17 후속.
- [x] **TASK 30** (큐 보충) — `test:q237-smoke` + `self-healing-ci.sh` · **`SPRINT_LOG`** · **335/2315** ✓ (avatarOutfits `imageUrl` nullability).
- [x] **TASK 37** (큐 보충) — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **335/2315** ✓ · Build ✓ (`rm -rf .next` 선행).
- [x] **TASK 40** (큐 보충) — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **C6 `[ ]` 기아 방지** (TASK37 **[x]** 후 큐 보충).

**Notes:** **CONTINUE(C6) 2026-03-20:** TASK10·12·17·20·30·37·**40 [x]** · q237 **3 files / 7 tests** ✓ · `self-healing-ci.sh` **339/2327** ✓ · Build ✓ (`rm -rf .next` 선행) · **다음 `[ ]` 없음** (기아 방지 시 C1 큐 보충).

### C4 — UI ENGINEER (289) — active (보드 S83)

- [x] **TASK 4** — **`bty-arena/lab`** `<main>` · `uxPhase1Stub.arenaLab*` · **`npm run lint` ✓** · **완료. 2026-03-19 C4.**
- [x] **TASK 11** — **`bty-arena/result`** 미션 `<main>` · `arenaMissionResult*` · **`npm run lint` ✓**.
- [x] **TASK 15** (큐 보충) — **`bty-arena/beginner`** `<main>` · `arenaBeginnerPath*` · **`npm run lint` ✓** · **완료. 2026-03-19 C4.**
- [x] **TASK 19** (큐 보충) — **`bty-arena/record`** · `ScreenShell.mainAriaLabel` · `arenaRecordPageMainRegionAria` · **`npm run lint` ✓** · **완료. 2026-03-19 C4.**
- [x] **TASK 24** (큐 보충) — **`bty-arena/wireframe`** `<main>` · `wireframeLandmarkAria` · 로케일 **`ko`|`en`** · **`npm run lint` ✓**.
- [x] **TASK 25** (큐 보충) — **`/[locale]`** 랜딩 **`landing.landingHubMainRegionAria`** · **`npm run lint` ✓**.
- [x] **TASK 31** (큐 보충) — **`train/day/[day]`** **`page` → `page.client`** · **`<main aria-label={train.lessonLabel}>`** · **`npm run lint` ✓** · **완료. 2026-03-19 C4.**
- [x] **TASK 33** (큐 보충) — **`dojo/result`** **`DojoResultClient`** **`<main>`** · `dojoResult.*` · **`npm run lint` ✓** · **완료. 2026-03-19 C4.**
- [x] **TASK 35** (큐 보충) — **`train/start`** **`journeyStartMainRegionAria`** **`<main>`** · **`npm run lint` ✓** · **완료. 2026-03-20 C4.**
- [x] **TASK 38** (큐 보충) — **`/train/28days`** **`<main aria-label={train.track28HubMainRegionAria}>`** · ko/en · **`npm run lint` ✓** · **완료. 2026-03-20 C4.**
- [x] **TASK 45** (큐 보충) — **`/train/28days/day/[day]`** **`<main aria-label={train.track28DayMainRegionAria}>`** · ko/en · **`npm run lint` ✓** · **완료. 2026-03-20 C4.**

**Notes:** **CONTINUE(C4) 2026-03-20:** TASK4·11·15·19·24·25·31·33·35·38·**45 [x]** · **C4 `[ ]` 없음** · 보드 동기.

### C3 — DOMAIN ENGINEER (289) — active (보드 S83)

- [x] **TASK 8** — **`arenaSystemMessageFromUnknown`** + **`arenaSystemMessageFromUnknown.edges.test.ts`** · `ResolveOutcome.systemMessage` 경계 · barrel.
- [x] **TASK 9** — **`POST /api/bty/arena/signals`** `route.test.ts` — 401 · 400 (비객체 JSON · 필수 필드 누락).
- [x] **TASK 13** (큐 보충) — **`arenaResolveOutcomeFromUnknown`** + **`arenaResolveOutcomeFromUnknown.edges.test.ts`** · `ResolveOutcome` 정규화 · interpretation **1줄 이상** · barrel.
- [x] **TASK 16** (큐 보충) — **`arenaMissionChoiceShapeFromUnknown`** · **`arenaPrimaryChoiceFromUnknown`** · **`arenaReinforcementChoiceFromUnknown`** + **`arenaMissionChoiceShapeFromUnknown.edges.test.ts`** · barrel.
- [x] **TASK 22** (큐 보충) — **`arenaScenarioCopyFieldsFromUnknown`** + **`arenaScenarioCopyFieldsFromUnknown.edges.test.ts`** · `ArenaScenario` 헤더용 `stage`·`caseTag`·`title` · barrel.
- [x] **TASK 26** (큐 보충) — **`arenaScenarioDescriptionLinesFromUnknown`** + **`arenaScenarioDescriptionLinesFromUnknown.edges.test.ts`** · `ArenaScenario.description` · **≥1** line · caps **64**/**4096** · barrel.
- [x] **TASK 28** (큐 보충) — **`arenaScenarioOutcomesFromUnknown`** + **`arenaScenarioOutcomesFromUnknown.edges.test.ts`** · `ArenaScenario.outcomes` · **`ARENA_SCENARIO_OUTCOMES_MAX_KEYS` 32** · barrel.
- [x] **TASK 29** (큐 보충) — **`arenaScenarioMissionChoiceRowsFromUnknown`** + row helpers + **`arenaScenarioMissionChoiceRowsFromUnknown.edges.test.ts`** · **A/B/C** · **X/Y** · barrel.
- [x] **TASK 34** (큐 보충) — **`arenaScenarioFromUnknown`** + **`arenaScenarioFromUnknown.edges.test.ts`** · full **`ArenaScenario`** · barrel.
- [x] **TASK 39** (큐 보충) — **`listArenaScenarioOutcomeKeyViolations`** + **`arenaScenarioOutcomeKeyViolations.edges.test.ts`** · `outcomes` keys vs choice ids · barrel · Vitest **4** ✓.
- [x] **TASK 42** (큐 보충) — **`arenaRunTypeFromUnknown`** + **`arenaRunTypeFromUnknown.edges.test.ts`** · lab/mission/beginner · barrel · Vitest **3** ✓.
- [x] **TASK 44** (큐 보충) — **`arenaRunLifecyclePhaseFromUnknown`** + **`arenaRunLifecyclePhaseFromUnknown.edges.test.ts`** · in_progress/completed/aborted · barrel · Vitest **3** ✓.

**Notes:** **CONTINUE(C3) 2026-03-20:** S83 TASK8·9·13·16·22·26·28·29·34·39·42·**44 [x]** · **`arenaRunLifecyclePhaseFromUnknown`** · 보드 동기. **339/2327** (post-TASK44).

---

## SPRINT 288 — **archived (보드 SPRINT 82)**

- **요약:** 이번 런 미완인데 C3·C5·C6 표 행이 **전부 [x]** · C1·C4만 `[ ]` → `check-parallel-task-queue` **exit 2** → **S83** (`PARALLEL_QUEUE_REFILL` §3 · 2026-03-20).
- **세부:** 보드 **「이전 런: SPRINT 82」** 표 · 종료 시점 C7 **327/2287** ✓.

### C5 — UI ENGINEER (288)

- [x] **TASK 1** [VERIFY] Release Gate Foundry **82**차 — **310 / 2229** ✓ · Build ✓ (`rm -rf .next` 선행) · `ArenaResolveScreen` 세션 시나리오 상태·import 정리.
- [x] **TASK 6** [VERIFY] 엘리트 3차 §3 — §2 6항목 대조 **PASS** · `ELITE_3RD` §3 동기.
- [x] **TASK 13** (큐 보충) — Gate·엘리트 스테일 · `ELITE_3RD` §3 동기 · **310/2229** ✓.
- [x] **TASK 17** (큐 보충) — Gate·빌드 스테일 **재점검** · **313/2239** ✓ · `BTY_RELEASE_GATE_CHECK` 동기.

- [x] **TASK 22** (큐 보충) — Gate·`ELITE_3RD` 스테일 · **313/2239** · TASK22 VERIFY 줄.
- [x] **TASK 24** (큐 보충 C5) — Gate·엘리트·빌드 · **315/2247** ✓.
- [x] **TASK 28** (큐 보충 C5) — Gate·엘리트·문서 스테일 · **316/2250** ✓.
- [x] **TASK 32** (큐 보충 C5) — Gate·엘리트·문서 스테일 · **318/2254** ✓.
- [x] **TASK 34** (큐 보충 C5) — Gate·엘리트·문서 스테일 · **324/2274** ✓.
- [x] **TASK 46** (큐 보충 C5) — Gate·엘리트·문서 스테일 · **326/2280** ✓.
- [x] **TASK 48** (큐 보충 C5) — Gate·엘리트·문서 스테일 · TASK46 후속 · **`BTY_RELEASE_GATE_CHECK`**·**`ELITE_3RD`** · **327/2287** ✓ · **S82 C5 `[ ]` 없음**.

**Notes:** **CONTINUE(C5) 2026-03-19:** TASK48 **[x]** — **`327/2287`** · Gate·엘리트 §3 동기 · **S82 C5 전행 [x]** · 미체크 없음·CONTINUE 중단.

### C6 — TESTFIX ENGINEER (288)

- [x] **TASK 10** — q237-smoke + self-healing-ci + `SPRINT_LOG`.
- [x] **TASK 14** (큐 보충) — `test:q237-smoke` + `self-healing-ci.sh` · **`SPRINT_LOG`** · **311 / 2233** ✓.
- [x] **TASK 18** (큐 보충) — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **313/2239** ✓.
- [x] **TASK 23** (큐 보충) — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **315/2247** ✓.
- [x] **TASK 27** (큐 보충) — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **316/2250** ✓.
- [x] **TASK 30** (큐 보충) — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **318/2254** ✓.
- [x] **TASK 36** 큐 보충 — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **320/2259** ✓.
- [x] **TASK 38** 큐 보충 — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **324/2274** ✓.
- [x] **TASK 41** 큐 보충 — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **324/2274** ✓.
- [x] **TASK 43** 큐 보충 — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **325/2277** ✓.
- [x] **TASK 47** 큐 보충 — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **326/2280** ✓.
- [x] **TASK 50** 큐 보충 — q237-smoke + `self-healing-ci.sh` · **`SPRINT_LOG`** · **327/2287** ✓ · Build ✓ (`rm -rf .next` 선행) · TASK47 후속 · **C6 S82 전행 [x]**.

**Notes:** **CONTINUE(C6) 2026-03-19:** TASK10·14·18·23·27·30·36·38·41·43·47·**50 [x]** · **C6 미체크 없음** (`327/2287` · q237 **7/7**).

---

## SPRINT 287 — **archived (보드 SPRINT 81)**

- **요약:** S81 완료 후 **C1만** `[ ]` 남음 → `check-parallel-task-queue` **exit 2** → **S82** `PARALLEL_QUEUE_REFILL` §3.
- **세부:** 상단 **「이전 런: SPRINT 81」** 표·`SPRINT_LOG` 참고.

---

### C5 — UI ENGINEER (287)

- [x] **TASK 1** [VERIFY] Release Gate Foundry **81**차 — **308 / 2216** ✓ · Build ✓ (`rm -rf .next` 선행).
- [x] **TASK 6** [VERIFY] 엘리트 3차 §3 — §2 6항목 대조 **PASS** · `ELITE_3RD` §3 동기.

**Notes:** **CONTINUE(C5) 2026-03-19** — TASK1·TASK6 완료 · 보드·`BTY_RELEASE_GATE_CHECK`·`CURRENT_TASK`·`ELITE_3RD` §3 반영.
- **CONTINUE(C5) 2026-03-19 (REFRESH):** 상단 **C5 — UI 1~5** 점검 **[x]** — Gate **81**/`§3` **81차** 동기 · `CURRENT_TASK`·보드 S81 C5 일치 · S82·First 잠금 = 보드 TASK7 · Elite UI 샘플 `elite/page.client` render-only · S82는 C1 refill 후.
- **CONTINUE(C5) 2026-03-19 (REFRESH 재갱신 후):** 플랜 **C2~C6 할일** 문구 교체 뒤 **C5 — UI 1~5** 재점검 **`[x]`** — 동일 인바리언트·문서 정합 유지.
- **CONTINUE(C5) 2026-03-19 (REFRESH S82 대기판):** **S81 10/10 [x]**·큐 exit2 전제 하 **C5 — UI 1~5** 재점검 **`[x]`** — First=C5 Gate·TASK7·Elite render-only·S82는 C1 refill.

### C4 — API ENGINEER (287)

- [x] **TASK 4** — Mentor `/bty/mentor` prefs 로딩 분기 `<main aria-label={pageMainLandmarkAria}>` (기존 본문과 동일 키).

**Notes:** **CONTINUE(C4) 2026-03-19:** S81 TASK4 — 제외 목록 외 Foundry **멘토** 로딩 랜드마크 보강 · Dashboard·Profile·Dojo·…·awakening 등 미포함.
- **CONTINUE(C4) 재호출 2026-03-19:** S81 표 **C4 TASK 4** 전행 `[x]` 확인 · **추가 C4 `[ ]` 없음** · **중단** (다음 배치는 C1 `PARALLEL_QUEUE_REFILL`/S82 등에서 오픈).
- **CONTINUE(C4) 2026-03-19:** 상단 **C4 — API 1~5** (REFRESH 블록) 전부 **[x]** — `test-avatar` 랜드마크·후보/점검/Lint/Elite 샘플 기록.
- **CONTINUE(C4) 2026-03-19 (2):** REFRESH **C4 — API 1~5** 재실행 **[x]** — **`admin/sql-migrations`** main·region·ko/en·로케일 프리픽스 링크.
- **CONTINUE(C4) 2026-03-19 (3):** REFRESH **C4 — API 1~5** **[x]** — **`admin/debug`** `main`+6·`section region`·`debugCopy` ko/en.
- **CONTINUE(C4) 2026-03-19 (4):** 플랜 **C4 — API** 재문구 **`[x]`** — **무코드** · `mentor-requests` S82 후보 메모 · lint PASS.
- **CONTINUE(C4) 재호출 (보드 우선):** S81 **C4 열 `[ ]` 없음** · 상단 **`#### C4 — API` 항목1** — **CONTINUE(C4) 중단** · S82는 C1 **`PARALLEL_QUEUE_REFILL`**.

### C4 — UI ENGINEER (288) — archived (보드 S82)

- [x] **TASK 4** — `admin/mentor-requests` `<main aria-label={mainRegionAria}>` · i18n `mentorRequestAdmin` ko/en (사용자 `/bty/mentor` 미포함).
- [x] **TASK 11** (큐 보충) — `admin/users` `<main>` · i18n `adminUsers` · `/${locale}/admin/quality`.
- [x] **TASK 15** (큐 보충) — `admin/quality` `<main>` · i18n `adminQuality` · admin nav `/${locale}/admin/…`.
- [x] **TASK 19** (큐 보충) — `admin/organizations` `<main>` · i18n `adminOrganizations` · `loading.message`.
- [x] **TASK 25** (큐 보충) — `admin/arena-membership` 등 `<main>` (organizations·quality·users 제외). **완료. 2026-03-22 C4.**
- [x] **TASK 29** (큐 보충) — `admin/login` + `/[locale]/admin` 허브 `<main>` · `adminLogin`·`adminHub` i18n · 로케일 redirect. **완료. 2026-03-22 C4.**
- [x] **TASK 33** (큐 보충) — **`journal`** Suspense·로딩·리다이렉트 `<main>` · `journalLoading*`·`journalRedirecting*` · `JournalLoadingShell`. **완료. 2026-03-23 C4.**
- [x] **TASK 37** (큐 보충) — **`dear-me`·`center`·`foundry` Suspense** `<main>` · `*LoadingShell` · `dearMeSuspense*`·`centerSuspense*`·`foundryHubSuspense*`. **완료. 2026-03-24 C4.**
- [x] **TASK 42** (큐 보충) — **`bty-arena`** 루·`/hub`·`ScreenShell.mainAriaLabel` · **`assessment` ResultClient** `<main>` · `dojoResultMainRegionAria`. **완료. 2026-03-25 C4.**
- [x] **TASK 45** (큐 보충) — **`bty-arena/play`**·**`/run`**·**`/play/resolve`** (`ArenaResolveSessionScreen`) `<main>`/`aria` · `arenaMissionPlay*`·`arenaResolveSession*`·`arenaRun.runPage*` · **lobby** 리다이렉트만 · **`npm run lint` ✓** · **완료. 2026-03-19 C4.**
- [→S83 TASK4] **TASK 51** (큐 보충) — 미완 **`[ ]`** · 범위 **S83 TASK4** PROMPT로 흡수 (`PARALLEL_QUEUE_REFILL` 2026-03-20).

**Notes:** S82 C4 닫힘 — 남은 접근성는 **`SPRINT 289`** **TASK4**에서 이어감.

### C3 — DOMAIN ENGINEER (288) — archived (보드 S82)

- [x] **TASK 8** — Arena domain 순수 규칙+테스트 1건 (`arenaLeaderboardScopeRoleLabel` · `leaderboardScope.roleToScopeLabel` 위임).
- [x] **TASK 9** — Arena API route 테스트 1건 (`GET /api/arena/mentor-requests` Supabase 조회 실패 **500**).
- [x] **TASK 12** (큐 보충) — `normalizeArenaMissionPayloadFromUnknown` + edges · `readMissionPayload` (`src/domain/arena/scenarios`).
- [x] **TASK 16** (큐 보충) — `isArenaHiddenStatLabel` + edges (`src/domain/arena/scenarios`).
- [x] **TASK 20** (큐 보충) — `arenaMissionChoiceToken` + edges (`src/domain/arena/scenarios`).
- [x] **TASK 21** (큐 보충) — `arenaScenarioDifficultyFromUnknown` + edges (`ScenarioDifficulty` from unknown string).
- [x] **TASK 26** (큐 보충) — **`arenaMissionOutcomeKeyFromChoiceIds`** + **`arenaMissionOutcomeKey.edges.test.ts`** (`src/domain/arena/scenarios`).
- [x] **TASK 31** (큐 보충) — **`arenaMissionOutcomeKeyPartsFromUnknown`** + **`arenaMissionOutcomeKeyPartsFromUnknown.edges.test.ts`** · `ArenaMissionOutcomeKeyParts` barrel.
- [x] **TASK 35** (큐 보충) — **`arenaOutcomeTraitWeightFromUnknown`** · **`arenaOutcomeTraitsPartialFromUnknown`** + **`arenaOutcomeTraitsFromUnknown.edges.test.ts`** (`ResolveOutcome.traits` 0–1).
- [x] **TASK 39** (큐 보충) — **`arenaScenarioIdFromUnknown`** · **`ARENA_SCENARIO_ID_MAX_LENGTH`** + **`arenaScenarioIdFromUnknown.edges.test.ts`** · barrel traits export 정합.
- [x] **TASK 40** (큐 보충) — **`arenaOutcomeMetaFromUnknown`** + **`arenaOutcomeMetaFromUnknown.edges.test.ts`** (`ResolveOutcome.meta` 3축).
- [x] **TASK 44** (큐 보충) — **`arenaActivatedHiddenStatsFromUnknown`** + edges · barrel · **완료. (보드 동기.)**
- [x] **TASK 49** (큐 보충) — **`arenaInterpretationLinesFromUnknown`** + **`arenaInterpretationLinesFromUnknown.edges.test.ts`** · `ARENA_INTERPRETATION_MAX_LINES` / line max · barrel · app import 금지.

**Notes:** **CONTINUE(C3) 2026-03-19:** S82 TASK8·9·12·16·20·21·26·31·35·39·40·44·**49 [x]** · **C3 미체크 없음** · Vitest 4 tests ✓ · 보드·Gate 동기.

### C6 — TESTFIX ENGINEER (287)

- [x] **TASK 10** — q237-smoke + self-healing-ci + `SPRINT_LOG`.

**Notes:** **CONTINUE(C6) 2026-03-19:** `test:q237-smoke` **3 files / 7 tests** ✓ · `self-healing-ci.sh` Lint·Test·Build **309 / 2222** ✓ · 상단 **C6 VERIFY 1~5** [x] · 워커표 **C6·10** `[x]` · `SPRINT_LOG`·`CURRENT_TASK` 반영.

---

## SPRINT 286 — closed (보드 SPRINT 80)

- **종료:** C5 **1·6** [x] Gate **80** **308/2216** · C3 **8·9** [x] · C6 **10** [x] · C1 **2·3·5·7**·C4 **4** `[ ]` → **S81** 흡수 · C3·C5 기아 → `PARALLEL_QUEUE_REFILL`.

---

### (이전 C6 — 286)

- [x] **TASK 10** — q237-smoke + self-healing-ci + `SPRINT_LOG`.

**Notes:** **CONTINUE(C6) 2026-03-19:** `test:q237-smoke` **7/7** ✓ · `self-healing-ci.sh` Lint·Test·Build **308 / 2216** ✓ (leaderboardScope trim 기대치 정합) · `SPRINT_LOG`·보드 S80 TASK10 동기.

---

## SPRINT 285 — closed (보드 SPRINT 79)

- **종료:** C3 **8·9** [x] · C1 **2·3·5·7**·C5 **1·6**·C4 **4**·C6 **10** `[ ]` → **S80** 흡수 · C3 기아 → `PARALLEL_QUEUE_REFILL`.

---

## SPRINT 284 — closed (보드 SPRINT 78)

- **종료:** C5 **1·6** [x] Gate **78** **306/2204** · C4 **4** [x] Dojo 50문항 a11y · C1 **2·3·5·7**·C3 **8·9**·C6 **10** `[ ]` → **S79** 흡수 · C4·C5 기아 → `PARALLEL_QUEUE_REFILL`.

---

## SPRINT 283 — closed (보드 SPRINT 77)

- **종료:** C5 **1·6** [x] Gate **77** **306/2204** · C4 **4** [x] assessment a11y · C3 **8·9** [x] · C6 **10** [x] · C1 **2·3·5·7** `[ ]` → **S78** 흡수 · C3·C5·C6 기아 → `PARALLEL_QUEUE_REFILL`.

---

## SPRINT 282 — closed (보드 SPRINT 76)

- **종료:** C5 **1·6** [x] Gate **76** **305/2199** · C4 **4** [x] bty index a11y · C3 **8·9** [x] · C1 **2·3·5·7**·C6 **10** `[ ]` → **S77** 흡수 · C3·C4·C5 기아 → `PARALLEL_QUEUE_REFILL`.

---

## SPRINT 280 — closed (보드 SPRINT 74)

### C5 — UI ENGINEER (280)

- [x] **TASK 1** [VERIFY] Release Gate Foundry **74**차 — **302 / 2186** ✓ · Build ✓ (`rm -rf .next` 선행).
- [x] **TASK 6** [VERIFY] 엘리트 3차 §3 — §2 6항목 대조 **PASS** · `ELITE_3RD` §3 동기.

**Notes:** **CONTINUE(C5) 2026-03-19** — TASK1·TASK6 완료 · 보드·`BTY_RELEASE_GATE_CHECK`·`CURRENT_TASK` 반영.

### C1 — COMMANDER (280)

- [ ] **TASK 2·3·5·7** — NEXT_BACKLOG·문서 178·179·180차·§ (**S73** 잔여 흡수).

### C4 — API ENGINEER (280)

- [x] **TASK 4** — Center/Foundry 접근성 1곳 (**Dashboard·Profile·Dojo·Journal·Avatar settings·Elite·Healing·Leaderboard** 제외).

**Notes:** **CONTINUE(C4) 2026-03-19:** Growth **`/growth`** — `<main aria-label={growthHubMainRegionAria}>` (기존 uxPhase1Stub i18n). Dashboard·Profile·Dojo·Journal·Avatar·Elite·Healing·Leaderboard 미포함.

### C3 — DOMAIN ENGINEER (280)

- [x] **TASK 8** — Arena domain 순수 규칙+테스트 1건.
- [x] **TASK 9** — Arena API route 테스트 1건.

**Notes (S287/81 C3):** **CONTINUE(C3) 2026-03-19** — `arenaLeaderboardMondayUtcFromDate` + edges · `leaderboardScope`가 domain Monday UTC 기준 사용 · `GET /api/arena/leaderboard` 과거 월요일 `week` **400** 회귀(fake timers). (보드 S81 TASK 8·9 **[x]**.)
**Notes (S75/281 C3):** **CONTINUE(C3) 2026-03-19** — `arenaRunsCursorMaxLength` + `isArenaRunsCursorOverMax` edges · `GET /api/arena/runs` cursor over max **400** 회귀. (보드 S75 TASK 8·9 **[x]**.)
**Notes (S76/282 C3):** **CONTINUE(C3) 2026-03-19** — `arenaRecommendationSourceFromParam` + edges · `GET /api/arena/dashboard/summary` source param 회귀. (보드 S76 TASK 8·9 **[x]**.)
**Notes (S77/283 C3):** **CONTINUE(C3) 2026-03-19** — `arenaLabAttemptsRemaining` + edges · `GET /api/arena/lab/usage` attemptsRemaining 0 회귀. (보드 S77 TASK 8·9 **[x]**.)

### C6 — TESTFIX ENGINEER (280)

- [x] **TASK 10** — q237-smoke + self-healing-ci + `SPRINT_LOG`.

**Notes:** **CONTINUE(C6) 2026-03-19:** `test:q237-smoke` **7/7** ✓ · `self-healing-ci.sh` **303 / 2190** ✓ · Lint·Build ✓ (선행 build로 `.next/types` 확보) · `SPRINT_LOG`·보드 TASK10 동기.

---

## SPRINT 279 — closed (보드 SPRINT 73)

- **종료:** C5 **1·6** **[x]** · C4 **4** **[x]** · C3 **8·9** **[x]** · C6 **10** **[x]** · C1 **2·3·5·7** `[ ]` → **S74** 흡수 · C4·C5·C6 기아 → `PARALLEL_QUEUE_REFILL`.

| 워커 | S73 |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | **2·3·5·7** → **74** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C2** | C5 **TASK1** 후·다음 push Gate |

### C5 — UI ENGINEER (279) — closed

- [x] **TASK 1** [VERIFY] Release Gate Foundry **73**차 — **302 / 2184** ✓ · Build ✓.
- [x] **TASK 6** [VERIFY] 엘리트 3차 §3 — PASS.

### C4 — API ENGINEER (279) — closed

- [x] **TASK 4** — Leaderboard `leaderboardMainRegionAria`.

### C3 — DOMAIN ENGINEER (279) — closed

- [x] **TASK 8·9** — `clampArenaReflectUserTextToMax`·POST /api/arena 200.

### C6 — TESTFIX ENGINEER (279) — closed

- [x] **TASK 10** — q237-smoke+CI **302/2184**.

---

## SPRINT 278 — closed (보드 SPRINT 72)

- **종료:** C5 **1·6** **[x]** · C4 **4** **[x]** · C3 **8·9** **[x]** · C6 **10** **[x]** · C1 **2·3·5·7** `[ ]` → **S73** 흡수 · C3·C4·C5 기아 → `PARALLEL_QUEUE_REFILL`.

| 워커 | S72 |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | **2·3·5·7** → **73** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C2** | C5 **TASK1** 후·다음 push Gate |

### C5 — UI ENGINEER (278) — closed

- [x] **TASK 1** [VERIFY] Release Gate Foundry **72**차 — **300 / 2179** ✓ · Build ✓.
- [x] **TASK 6** [VERIFY] 엘리트 3차 §3 — PASS.

### C4 — API ENGINEER (278) — closed

- [x] **TASK 4** — Healing `mainLandmarkAria`.

### C3 — DOMAIN ENGINEER (278) — closed

- [x] **TASK 8·9** — `normalizeOptionalArenaBodyString`·POST /api/arena 401·400.

### C6 — TESTFIX ENGINEER (278) — closed

- [x] **TASK 10** — q237-smoke+CI **301/2182**.

---

## SPRINT 277 — closed (보드 SPRINT 71)

- **종료:** C5 **1** [x] · C4 **4** [x] · C3 **8·9** [x] · C6 **10** [x] (SPRINT_PLAN) · C1·C5 6·C6(보드) `[ ]` → **S72** 흡수 · C3 기아 → `PARALLEL_QUEUE_REFILL`.

| 워커 | S71 |
|------|-----|
| **C5** | **1** **[x]** · **6** → **72** |
| **C1** | **2·3·5·7** → **72** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C2** | C5 **TASK1** 후·다음 push Gate |

### C5 — UI ENGINEER (277) — closed

- [x] **TASK 1** [VERIFY] Release Gate Foundry **71**차 — **298 / 2173** ✓ · Build ✓.
- [ ] **TASK 6** → **72 TASK6**.

### C4 — API ENGINEER (277) — closed

- [x] **TASK 4** — Elite `elitePageMainRegionAria`.

### C3 — DOMAIN ENGINEER (277) — closed

- [x] **TASK 8·9** — `arenaAvatarUploadLimits`·avatar/upload 401·400.

### C6 — TESTFIX ENGINEER (277) — closed

- [x] **TASK 10** — q237-smoke+CI **298/2173**.

---

## SPRINT 276 — closed (보드 SPRINT 70)

- **종료:** C5 **1·6** **[x]** · C4 **4** **[x]** · C3 **8·9** **[x]** · C6 **10** **[x]** · C1 **2·3·5·7** `[ ]` → **S71** 흡수 · C3·C4·C5 기아 → `PARALLEL_QUEUE_REFILL`.

| 워커 | S70 |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | **2·3·5·7** → **71** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C2** | C5 **TASK1** 후·다음 push Gate |

### C5 — UI ENGINEER (276) — closed

- [x] **TASK 1** [VERIFY] Release Gate Foundry **70**차 — **298 / 2173** ✓ · Build ✓ · `unlocked-scenarios` import 수정.
- [x] **TASK 6** [VERIFY] 엘리트 3차 §3 — PASS.

### C1 — COMMANDER (276) — closed

- [ ] **TASK 2·3·5·7** → **71** (잔여).

### C4 — API ENGINEER (276) — closed

- [x] **TASK 4** — Dashboard `dashboardMainRegionAria`.

### C3 — DOMAIN ENGINEER (276) — closed

- [x] **TASK 8·9** — `arenaContentLocaleFromParam`·profile/avatar 401.

### C6 — TESTFIX ENGINEER (276) — closed

- [x] **TASK 10** — q237-smoke+CI **298/2173**.

---

## SPRINT 275 — closed (보드 SPRINT 69)

- **종료:** C5 **1·6** **[x]** · C4 **4** **[x]** · C3 **8·9** **[x]** · C6 **10** **[x]** · C1 **2·3·5·7** `[ ]` → **S70** 흡수 · C3·C4·C5·C6 기아 → `PARALLEL_QUEUE_REFILL`.

| 워커 | S69 |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | **2·3·5·7** → **70** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C2** | C5 **TASK1** 후·다음 push Gate |

### C5 — UI ENGINEER (275) — closed

- [x] **TASK 1** [VERIFY] Release Gate Foundry **69**차 — **294 / 2164** ✓ · Build ✓ (`rm -rf .next` 선행·self-healing-ci PASS).
- [x] **TASK 6** [VERIFY] 엘리트 3차 §3 — §2 6항목 대조 **PASS** · `ELITE_3RD` §3 동기.

**Notes:** **CONTINUE(C5) 2026-03-19** — TASK1·TASK6 완료.

### C1 — COMMANDER (275) — closed

- [ ] **TASK 2·3·5·7** → **70** (잔여 · NEXT_BACKLOG·178~180·§).

### C4 — API ENGINEER (275) — closed

- [x] **TASK 4** — **`/bty/profile/avatar`** `avatarSettingsMainRegionAria` (ko/en). Profile·Dojo·Journal 제외.

**Notes:** **CONTINUE(C4) 2026-03-19** — 로딩·에러·본문 `<main aria-label>`.

### C3 — DOMAIN ENGINEER (275) — closed

- [x] **TASK 8** — `isValidArenaAvatarUserIdKey` + `arenaAvatarUserIdParam.edges.test.ts`.
- [x] **TASK 9** — `GET /api/arena/avatar` **400** (missing·invalid `userId`) · `route.test.ts`.

**Notes:** **CONTINUE(C3) 2026-03-19** — `avatar/route.ts` domain 정합.

### C6 — TESTFIX ENGINEER (275) — closed

- [x] **TASK 10** — q237-smoke + self-healing-ci + `SPRINT_LOG`.

**Notes:** **CONTINUE(C6) 2026-03-19** — **7/7** · **294 / 2164** · Build ✓ (`rm -rf .next` 선행).

---

## SPRINT 274 — closed (보드 SPRINT 68)

- **종료:** C5 **1·6** **[x]** · C4 **4** **[x]** · C3 **8·9** **[x]** · C6 **10** **[x]** · C1 **2·3·5·7** `[ ]` → **S69** 흡수 · C3·C4·C5·C6 기아 → `PARALLEL_QUEUE_REFILL`.

| 워커 | S68 |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | **2·3·5·7** → **69** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C2** | C5 **TASK1** 후·다음 push Gate |

### C5 — UI ENGINEER (274) — closed

- [x] **TASK 1** [VERIFY] Release Gate Foundry **68**차 — **294 / 2164** ✓ · Build ✓ (`rm -rf .next` ENOENT 회피).
- [x] **TASK 6** [VERIFY] 엘리트 3차 §3 — §2 6항목 대조 **PASS** · `ELITE_3RD` §3 동기.

**Notes:** **CONTINUE(C5) 2026-03-19** — TASK1·TASK6 완료 · 보드·`BTY_RELEASE_GATE_CHECK`·`CURRENT_TASK` 반영.

### C1 — COMMANDER (274) — closed

- [ ] **TASK 2·3·5·7** → **69** (잔여 · NEXT_BACKLOG·178~180·§).

### C4 — API ENGINEER (274) — closed

- [x] **TASK 4** — Journal `/[locale]/journal` `journalMainRegionAria` (ko/en). Profile·Dojo Result 제외.

**Notes:** **CONTINUE(C4) 2026-03-19** — `page.client.tsx`·i18n.

### C3 — DOMAIN ENGINEER (274) — closed

- [x] **TASK 8** — `isArenaProgramLevelUnlockedByMax` + `arenaProgramLevelUnlockedByMax.edges.test.ts`.
- [x] **TASK 9** — `GET /api/arena/unlocked-scenarios` **401** · `route.test.ts`.

**Notes:** **CONTINUE(C3) 2026-03-19** — domain 헬퍼·핸들러 정합.

### C6 — TESTFIX ENGINEER (274) — closed

- [x] **TASK 10** — q237-smoke + self-healing-ci + `SPRINT_LOG`.

**Notes:** **CONTINUE(C6) 2026-03-19** — **7/7** · **294 / 2164** · Build ✓ (`clean .next`).

---

## SPRINT 273 — closed (보드 SPRINT 67)

- **종료:** C5 **1** **[x]** · **6** `[ ]` · C4 **4** **[x]** · C3 **8·9** **[x]** · C6 **10** `[ ]` · C1 **2·3·5·7** `[ ]` → **S68** 흡수 · C3·C4 기아 → `PARALLEL_QUEUE_REFILL`.

| 워커 | (67) |
|------|-----|
| **C5** | **1** **[x]** · **6** → **68** |
| **C1** | → **68** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | → **68** |

### C5 — UI ENGINEER (273) — closed

- [x] **TASK 1** Gate **67** — **290 / 2155** ✓.
- [ ] **TASK 6** → **68** (엘리트 §3).

### C4 — closed

- [x] **TASK 4** Foundry Profile `profileMainRegionAria` (ko/en).

### C3 — closed

- [x] **TASK 8** `beginnerRunEventStep.edges.test.ts` · `isValidBeginnerEventStep`.
- [x] **TASK 9** `POST /api/arena/beginner-event` **401**·**400**.

### C6 — TESTFIX ENGINEER (273)

- [ ] **TASK 10** → **68** (q237+CI).

---

## SPRINT 272 — closed (보드 SPRINT 66)

- **종료:** C5 **1·6**·C4 **4**·C3 **8·9**·C6 **10** **[x]** · C1 **2·3·5·7** → **S67** 흡수 · 병렬 큐 보충.

| 워커 | S66 |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | → **67** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |

### C5 — UI ENGINEER (272) — closed

- [x] **TASK 1** Gate **66** — **288/2148** ✓.
- [x] **TASK 6** 엘리트 §3 66차.

### C4 — closed

- [x] **TASK 4** Dojo Result `dojoResultMainRegionAria`.

### C3 — closed

- [x] **TASK 8** `scenarioDisplayCodeId.edges.test.ts`.
- [x] **TASK 9** `POST /api/arena/free-response` 401·400.

### C6 — closed

- [x] **TASK 10** q237 **7/7** · **290/2155** ✓.

---

## SPRINT 271 — closed (보드 SPRINT 65)

- **종료:** C5 **1·6**·C4 **4**·C3 **8·9**·C6 **10** **[x]** · C1 **2·3·5·7** → **S66** 흡수. Gate **65** **288/2148** ✓.

| 워커 | (65) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C1** | → **66** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |

### C5 — UI ENGINEER (271) — closed

- [x] **TASK 1** Gate **65**차 — **288 / 2148** ✓.
- [x] **TASK 6** 엘리트 3차 §3 65차.

### C4 — API ENGINEER (271) — closed

- [x] **TASK 4** — Integrity `integrityMainRegionAria` (ko/en).

### C3 — DOMAIN ENGINEER (271) — closed

- [x] **TASK 8** — `leaderboardNearMe.edges.test.ts`.
- [x] **TASK 9** — `POST /api/arena/beginner-run` 401·400.

### C6 — TESTFIX ENGINEER (271) — closed

- [x] **TASK 10** — q237 **7/7** · **286 / 2140** ✓.

---

## SPRINT 270 — closed (보드 SPRINT 64)

- **종료:** C5 **1·6**·C4 **4**·C3 **8·9**·C6 **10** **[x]** · C1 **2·3·5·7** → **S65** 흡수. Gate **64** **286/2140** ✓.

| 워커 | (64) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C1** | → **65** |
| **C4** | **4** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |

---

## SPRINT 269 — closed (보드 SPRINT 63)

- **284 / 2131** · Gate **63** ✓ · C5 **1·6 [x]** · C1·C4·C3·C6 → **64**.

| 워커 | (63) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C1** | → **64** |
| **C4** | → **64** |
| **C3** | → **64** |
| **C6** | **10** `[x]` *(S64 실행)* |

### C5 — UI ENGINEER (269) — closed

- [x] **TASK 1** Gate **63차** — **284 / 2131** ✓ · `arenaRunState.edges.test.ts` tsc.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C6 — TESTFIX ENGINEER (269) — closed

- [x] **TASK 10** — S64에서 실행 · q237 **7/7** · **284 / 2131** · Build ✓.

### C1·C4·C3 — S63 잔여 → S64

- TASK **2·3·4·5·7·8·9** 동일 행.

---

## SPRINT 268 — closed (보드 SPRINT 62)

- **284 / 2131** · **C3** 8·9 **[x]** · C5·C1·C4·C6 → **63**.

| 워커 | (62) |
|------|------|
| **C3** | **8·9** **[x]** |
| **C5** | → **63** |
| **C1** | → **63** |
| **C4** | → **63** |
| **C6** | **10** `[x]` *(S63 실행)* |

### C3 — DOMAIN ENGINEER (268) — closed

- [x] **TASK 8** `arenaRunState.edges.test.ts`.
- [x] **TASK 9** `POST /api/arena/lab/complete` **401**·**400**.

### C6 — TESTFIX ENGINEER (268) — closed

- [x] **TASK 10** — S63에서 실행 · q237 **7/7** · **284 / 2131** · Build ✓.

---

## SPRINT 267 — closed (보드 SPRINT 61)

- **282 / 2125** · Gate 61 ✓ · C5 **1·6 [x]** · C1·C4·C3·C6 → **62**.

| 워커 | (61) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | → **62** |
| **C4** | → **62** |
| **C3** | → **62** |
| **C6** | → **62** |

### C5 — UI ENGINEER (267) — closed

- [x] **TASK 1** Gate **61차** — **282 / 2125** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C1·C4·C3·C6 — S61 잔여 → S62

- TASK **2·3·4·5·7·8·9·10** 동일 행.

---

## SPRINT 266 — closed (보드 SPRINT 60)

- **280 / 2119** · Gate 60 ✓ · C5·C6 **[x]** · C1·C4·C3 **8·9** → **S61**.

| 워커 | (60) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **61** |
| **C4** | → **61** |
| **C3** | **8·9** → **61** |

### C5 — UI ENGINEER (266) — closed

- [x] **TASK 1** Gate **60차** — **280 / 2119** · q237 **7/7** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C6 — TESTFIX ENGINEER (266) — closed

- [x] **TASK 10** q237-smoke **7/7** · **280/2119** ✓.

### C1·C4·C3 — S60 잔여 → S61

- TASK **2·3·4·5·7·8·9** 동일 행.

---

## SPRINT 265 — closed (보드 SPRINT 59)

- **280 / 2119** · Gate 59 ✓ · C5 **1·6 [x]** · C1·C4·C3·C6 → **60**.

| 워커 | (59) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | → **60** |
| **C4** | → **60** |
| **C3** | → **60** |
| **C6** | → **60** |

### C5 — UI ENGINEER (265) — closed

- [x] **TASK 1** Gate **59차** — **280 / 2119** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C1·C4·C3·C6 — S59 잔여 → S60

- TASK **2·3·4·5·7·8·9·10** 동일 행.

---

## SPRINT 264 — closed (보드 SPRINT 58)

- **280 / 2119** · Gate 58 ✓ · C5·C6 [x] · C1·C4·C3 → **59**.

| 워커 | (58) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **59** |
| **C4** | → **59** |
| **C3** | → **59** |

### C5 — UI ENGINEER (264) — closed

- [x] **TASK 1** Gate **58차** — **280 / 2119** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C6 — TESTFIX ENGINEER (264) — closed

- [x] **TASK 10** q237 + CI **280/2119** ✓.

### C1·C4·C3 — S58 잔여 → S59

- TASK **2·3·4·5·7·8·9** 동일 행.

---

## SPRINT 263 — closed (보드 SPRINT 57)

- **280 / 2119** · Gate 57 ✓ · C5·C3·C6 **[x]** · C1·C4 → **58**.

| 워커 | (57) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **58** |
| **C4** | → **58** |

### C5 — UI ENGINEER (263) — closed

- [x] **TASK 1** Gate **57차** — **279 / 2115** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C3 — DOMAIN ENGINEER (263) — closed

- [x] **TASK 8** `arenaRunCompletion.edges.test.ts`.
- [x] **TASK 9** `POST /api/arena/event` **401**·**400**.

### C6 — TESTFIX ENGINEER (263) — closed

- [x] **TASK 10** q237 + CI **280/2119** ✓.

---

## SPRINT 262 — closed (보드 SPRINT 56)

- **279 / 2115** · Gate 56 ✓ · C5·C3·C6 [x] · C1·C4 → **57**.

| 워커 | (56) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **57** |
| **C1** | → **57** |
| **C4** | → **57** |

### C5 — UI ENGINEER (262) — closed

- [x] **TASK 1** Gate **56차** ✓.
- [x] **TASK 6** 엘리트 **PASS** ✓.

### C3 — DOMAIN ENGINEER (262) — closed

- [x] **TASK 8** — `reflectTextBounds.edges.test.ts`.
- [x] **TASK 9** — `GET /api/arena/weekly-stats` **401**·**200**.

### C6 — TESTFIX ENGINEER (262) — closed

- [x] **TASK 10** — q237-smoke + CI **279/2115** ✓.

---

## SPRINT 261 — closed (보드 SPRINT 55)

- **277 / 2108** · Gate 55 ✓ · C5·C3·C6 [x] · C1·C4 → **56**.

| 워커 | (55) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **56** |
| **C4** | → **56** |

### C5 — UI ENGINEER (261) — closed

- [x] **TASK 1** Gate **55차** — **277 / 2108** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C3 — DOMAIN ENGINEER (261) — closed

- [x] **TASK 8** `eliteMentorRequest.edges.test.ts`.
- [x] **TASK 9** `GET /api/arena/membership-request` 401·200.

### C6 — TESTFIX ENGINEER (261) — closed

- [x] **TASK 10** q237 **7/7** · CI **277/2108** ✓.

---

## SPRINT 260 — closed (보드 SPRINT 54)

- **275 / 2102** · Gate 54 ✓ · C5 [x] · C1·C4·C3·C6 → **55**.

| 워커 | (54) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | → **55** |
| **C4** | → **55** |
| **C3** | → **55** |
| **C6** | → **55** |

### C5 — UI ENGINEER (260) — closed

- [x] **TASK 1** Gate **54차** — **275 / 2102** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C3 / C6 — S54 잔여 → S55

- TASK **8·9·10** 미완 → **55** 동일 행.

---

## SPRINT 259 — closed (보드 SPRINT 53)

- **275 / 2102** · Gate 53 ✓ · C5·C3·C6 [x] · C1·C4 → **54**.

| 워커 | (53) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **54** |
| **C4** | → **54** |

### C5 — UI ENGINEER (259) — closed

- [x] **TASK 1** Gate **53차** — **275 / 2102** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C3 — DOMAIN ENGINEER (259) — closed

- [x] **TASK 8** `xpAwardDedup.edges.test.ts`.
- [x] **TASK 9** `GET /api/arena/weekly-xp` 401·200.

### C6 — TESTFIX ENGINEER (259) — closed

- [x] **TASK 10** q237-smoke + CI **275/2102** ✓.

---

## SPRINT 258 — closed (보드 SPRINT 52)

- **273 / 2097** · Gate 52 ✓ · C5·C3·C6 [x] · C1·C4 → **53**.

| 워커 | (52) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **53** |
| **C4** | → **53** |

---

## SPRINT 257 — closed (보드 SPRINT 51)

- **271 / 2091** · Gate 51 ✓ · 엘리트 §3 PASS · 잔여 C1·C3·C4·C6 → **52**.

---

## SPRINT 256 — closed (보드 SPRINT 50)

- **271 / 2091**·Build ✓·`eslint.ignoreDuringBuilds`·`NODE_OPTIONS 4096`·`outputFileTracingRoot`. C5·C3·C6 [x] · C1·C4 → **S51** (큐 보충).

| 워커 | (50) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **51** |
| **C4** | → **51** |

---

## SPRINT 255 — closed (보드 SPRINT 49)

- **종료 (2026-03-17):** 큐 보충으로 **S50** 오픈. Gate 49 **269/2086** 등 아카이브는 보드 S49 절 참고.

| 워커 | (49 최종) |
|------|-----------|
| **C5** | **1·6** **[x]** |
| **C1** | **2·3·5·7** → **50** |
| **C3** | **8·9** **[x]** |
| **C4** | **4** **[x]** — `/bty` 허브 region |
| **C6** | **10** **[x]** |

---

## SPRINT 254 — closed (보드 SPRINT 48)

- **종료 (2026-03-29):** C5·C3·C4·C6 전행 [x] · C1 **2·3·5·7** 미처리 → **S49** 흡수. **268 files / 2082 tests** (Gate 48).

| 워커 | (48 최종) |
|------|-----------|
| **C5** | TASK **1**·**6** **[x]** |
| **C1** | **2·3·5·7** → **49** |
| **C4** | TASK **4** **[x]** — My Page 개요 aria |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |

---

## SPRINT 253 — closed (보드 SPRINT 47)

- **종료 (2026-03-26):** 47에서 C3·C4·C5 **`[ ]` 없음** → **48 오픈**으로 병렬 큐 복구.

| 워커 | (47 최종) |
|------|-----------|
| **C5** | TASK **1**·**6** **[x]** |
| **C1** | TASK **2·3·5·7·10** 일부 → **48**에 흡수 |
| **C4** | TASK **4** **[x]** |
| **C3** | TASK **8·9** **[x]** |
| **C2** | **[x]** Gate 동기 |
| **C6** | 회귀 기록 **[x]** |

### C5 — UI ENGINEER (253)

- [x] **TASK 1** [VERIFY] Release Gate A~F Foundry 47차 — Vitest **266 / 2076**·Build ✓·`coreXpDisplay` NaN 표시키·`BTY_RELEASE_GATE_CHECK`·보드·`CURRENT_TASK`.
- [x] **TASK 6** [VERIFY] 엘리트 3차 체크리스트 — §2 6항목 **PASS**·`ELITE_3RD_SPEC_AND_CHECKLIST` §3.

**Notes:** **CONTINUE(C5) 2026-03-23** — C5 **253·보드 47** 행 **전원 [x].**
- **CONTINUE(C5) 2026-03-24:** 동일 — 보드 **SPRINT 47** C5 TASK **1·6 [x]** · **할 `[ ]` 없음** · **중단** (다음 큐 = C1 splint → **SPRINT 48**).
- **CONTINUE(C5) 재호출:** **미체크 없음** · **중단** (C1이 **SPRINT 48**/254 열 때까지 C5 대기).

### C3 — DOMAIN ENGINEER (253)

- [x] **TASK 8** — Arena domain 순수 규칙+테스트: `bty-app/src/domain/rules/coreXpDisplay.edges.test.ts` (음수·초대값 Core XP 표시 키; 주간 랭킹 무관).
- [x] **TASK 9** — Arena API: `GET /api/arena/today-xp` — null·비숫자 `xp` 행 합산 **200** `xpToday`.

**Notes:** **2026-03-23 CONTINUE** — vitest **266 files / 2076 tests** ✓.

### C4 — API ENGINEER (253)

- [x] **TASK 4** [UI] Center/Foundry 접근성 — `/growth` 카드 네비를 **`section role=region`** + **`growthHubMainRegionAria`** (ko/en). render-only. `sprint252-journey-growth-regression.smoke.test.ts` **4** ✓.
- **CONTINUE(C4) 2026-03-24:** C4 **`[ ]` 없음** — C1 문서 행·splint **48**까지 대기.

### C2 — GATEKEEPER (253)

- [x] **C5 TASK1(Gate 47) 후** — `BTY_RELEASE_GATE_CHECK`·`SPRINT_LOG`·self-healing-ci **266 files / 2076 tests**·Build PASS (2026-03-24). 워크스페이스: `arenaHubTitle` 타입·q237 result smoke·wireframe 링크 보정 후 CI 녹색.
- [x] **배포 `6afdfe4`** (`58b8342..6afdfe4` → origin/main, 108 files +5,767/-846) — §A~F·MVP·`SPRINT_LOG`·**277 / 2108**·build PASS.
- [x] **`origin/main` 갱신 `d7d5a24`** (`6afdfe4..d7d5a24`, 배포 **3ca0233** + run 라우트·Worker CI) — §A~F·MVP·`SPRINT_LOG`·**279 / 2117**·build PASS.
- [x] **다음 `origin/main` push**(**d7d5a24** 초과) 시 §A~F·MVP·커밋 수치 **재1회** — **`7654875`** · `d7d5a24..7654875` (**57 files**, +2003/−525) · `self-healing-ci` **292 / 2159** · Build ✓ · `BTY_RELEASE_GATE_CHECK`·`SPRINT_LOG` (2026-03-19).
- [x] **다음 `origin/main` push**(**7654875** 초과) 시 §A~F·MVP·커밋 수치 **재1회** — **`822c19c`** · `7654875..822c19c` (**2 commits**, **340 files**, +18057/−2574) · `self-healing-ci` **335 / 2315** · Build ✓ · `BTY_RELEASE_GATE_CHECK`·`SPRINT_LOG` (C2, 2026-03-20).
- [ ] **다음 `origin/main` push**(**822c19c** 초과) 시 §A~F·MVP·커밋 수치 **재1회**.

**CONTINUE(C2):** HEAD **`822c19c`** — 아래 **`822c19c` 초과** `[ ]`는 **추가 push 후** 실행.

- **CONTINUE(C2) 2026-03-20 (S253 push-Gate):** `git fetch` · `822c19c..origin/main` **0 commits** — **BLOCKER:** `822c19c` 초과 push 없음 · `[ ]` 유지.
- **CONTINUE(C2) 2026-03-21 (S253 push-Gate 재확인):** `git fetch` · 동일 **0** — **BLOCKER** 동일.
- **CONTINUE(C2) (S253 push-Gate 재확인):** `git fetch` · `822c19c..origin/main` **0** — **BLOCKER** 동일.

**Notes:** **CONTINUE(C2) 2026-03-19** — post-`d7d5a24` 게이트 완료·상기 `[x]`. **CONTINUE(C2) 재호출:** `origin/main` = **`7654875`** · `7654875..origin/main` **0 commits** — 아래 `[ ]` 미실행. **BLOCKER:** `7654875` 초과 push 없음 — push 후 CONTINUE. **CONTINUE(C2) 2026-03-19 (재확인):** `git fetch` 후 동일 — `origin/main`=`7654875` · ahead **0** — **BLOCKER:** `7654875` 초과 push 없음 · `[ ]` 유지. **CONTINUE(C2) 2026-03-19:** `git fetch` 재시도 — 동일 HEAD · ahead **0** — **BLOCKER:** `7654875` 초과 push 없음. **CONTINUE(C2):** `git fetch` — `7654875..origin/main` **0** — **BLOCKER:** `7654875` 초과 push 없음 · `[ ]` 유지. **CONTINUE(C2):** fetch 재확인 — 동일 **BLOCKER**. **CONTINUE(C2):** `origin/main` **7654875** · ahead **0** — **BLOCKER** 동일. **CONTINUE(C2):** fetch — ahead **0** — **BLOCKER** 동일. **CONTINUE(C2):** `git fetch` — still **0** ahead — **BLOCKER** 동일. **CONTINUE(C2):** fetch — **0** ahead — **BLOCKER** 동일. **CONTINUE(C2):** `git fetch` — **0** — **BLOCKER** 동일. **CONTINUE(C2):** ahead **0** — **BLOCKER** 동일. **CONTINUE(C2):** fetch — **no new commits** — **BLOCKER** 동일. **CONTINUE(C2):** `git fetch` — **BLOCKER** 동일. **CONTINUE(C2):** **0** ahead — **BLOCKER** 동일. **CONTINUE(C2):** `git fetch` — 동일 **BLOCKER**. **CONTINUE(C2):** fetch — **0** ahead — **BLOCKER** 동일. **CONTINUE(C2):** `git fetch` — 변화 없음 — **BLOCKER** 동일. **CONTINUE(C2):** fetch — **0** — **BLOCKER** 동일. **CONTINUE(C2):** `git fetch` — **BLOCKER** 동일. **CONTINUE(C2):** ahead **0** — **BLOCKER** 동일.

### C6 — TESTFIX ENGINEER (253)

- [x] `npm run test:q237-smoke` — **3 files / 7 tests** ✓.
- [x] `self-healing-ci.sh` — Lint ✓ · Test **266 files / 2076 tests** ✓ · Build ✓ · 수치 `SPRINT_LOG` **2026-03-24** 반영.

**Notes:** **CONTINUE(C6) 2026-03-24:** C5 TASK1·6 완료 후 실행. `uxPhase1Stub` 타입에 arena hub·result i18n 키 보강(`tsc` 녹색). **266/2076** PASS.

---

## SPRINT 252 — closed (2026-03-21)

- **Status:** closed — C3·C4·C5·C6·TASK8·9 완료. **C1 splint** → 보드 **SPRINT 47**·**253** 로 이관 (2026-03-23).

### C2 — GATEKEEPER (252) — 아카이브

- [x] **배포 `58b8342` 시점** Gate 완료. **다음 C2 일:** **253** — 배포 push 시 §A~F.

### C3 — DOMAIN ENGINEER (252)

**Allowed:** `bty-app/src/domain/center`, `bty-app/src/domain/foundry` 등 **해당 시스템 domain만** (Arena domain은 `rules/`·`leadership-engine/` 등 기존 경로; `lib`/`app` import 금지).

- [x] **Foundry:** `docs/CURSOR_TASK_BOARD.md` SPRINT 46 **TASK 8** — Center/Foundry **미커버 경계** `*.test.ts` 1건 → `npm test` 녹색. **`healing.edges.test.ts`** (celebration 키·액트 스킵·3 선행 위반).
- [x] **Foundry:** 동 보드 **TASK 9** — Center/Foundry **route** 테스트 1건 → 녹색. **`POST /api/journey/entries`** 잘못된 JSON → `day` 기본 1 upsert.
- [x] (선택) TASK8·9 완료 — C1 스킵 정리 불필요.

**Notes (252 C3):** **2026-03-21 CONTINUE** — 보드 SPRINT 46 TASK8·9 [x] 동기·vitest **265 files / 2073 tests** ✓.

### C4 — API ENGINEER (252)

**Allowed:** `src/app/api/`, `src/middleware.ts`

- [x] **`POST /api/journey/bounce-back`**(및 Journey 관련 GET) **회귀** — `ARENA_DOMAIN_SPEC` §4-11b·vitest 녹색. *(252: bounce-back·profile·entries 34 tests ✓.)*
- [x] API 변경 시 **handler → service만**·§4 JSDoc 1블록 갱신. *(252: 본 회귀 구간 API 변경 없음·해당 없음.)*
- **CONTINUE(C4) 2026-03-23:** C4 **미체크 없음** — C1 splint·**253**·보드 이번 런까지 API 큐 대기.

### C5 — UI ENGINEER (252)

**Allowed:** `src/app/[locale]/`, `src/components/`

- [x] Journey·Comeback·Growth 서브네비 **회귀 1건** — `growth/sprint252-journey-growth-regression.smoke.test.ts` (i18n en/ko·Growth RSC·Journey href·Arena 정책).
- [x] 루트 **`bty-arena/page.tsx` 수정 금지** 재확인 — 동 스모크 `growth\/journey`·`JourneyBoard` 미포함 assert.

**Notes (252 C5):** **CONTINUE(C5) 2026-03-21** — 위 2건 완료.
- **CONTINUE(C5) 2026-03-22:** C5 **252 미체크 없음** — C1 splint·보드 **253**까지 UI 큐 대기.
- **CONTINUE(C5) 재호출:** 동일 — **252 C5 `[ ]` 없음**·중단 (`CURSOR_TASK_BOARD` 이번 런 C5행도 확인 시 splint 전 과제 없음).

### C6 — TESTFIX ENGINEER (252)

- [x] `npm run test:q237-smoke`.
- [x] `bty-app/scripts/self-healing-ci.sh` — Lint·Test·Build PASS 후 **수치** `SPRINT_LOG` 또는 §C7에 기록.

**Notes:** **CONTINUE(C6) 2026-03-21:** q237-smoke **3 files / 7 tests** ✓; self-healing-ci **264 files / 2067 tests** · Lint ✓ · Build ✓ — 수치 `SPRINT_LOG` 2026-03-21 반영.

### C1 — COMMANDER (252) — 아카이브

- [x] **보드 SPRINT 47 오픈 (2026-03-23)** — splint 10 역할 대행·10행 `[ ]` 생성.

---

## SPRINT 251 — closed (참고)

- **Mode:** FOUNDRY
- **Sprint ID:** SPRINT **251**
- **Status:** closed
- **Objective (완료):** C3·C4·C5 TASK1–5·C6·C2 Gate **[x]** — Journey·bounce-back·Healing·LE·스테이지·테스트.

---

## GLOBAL RULES

- 완료 `[x]`, 막힘 `BLOCKER:`.
- REFRESH: 로그·게이트·플랜·코드 `[x]` 정합.

---

## C1 — COMMANDER

Planning only. `REFRESH`로 본 문서·로그만 갱신.

- **Last C1 REFRESH:** **2026-03-17** — **SPRINT 50** — S49 병렬 완료·C1 잔여 → **256**·**10행 `[ ]`**. REFRESH 동기.

---

## C2 — GATEKEEPER

**배치:** SPRINT 251. **배포 `58b8342` Gate 완료.** 다음 배포 push 시 TASK1·2 재오픈(C1 REFRESH 관행).

**Tasks:**
- [x] 배포 시 1회: BTY_RELEASE_GATE_CHECK § A~F·MVP_DEPLOYMENT_READINESS → 문서·SPRINT_LOG. **`58b8342`** (`cce5374..58b8342` → origin/main, 202 files +11,498/-718).
- [x] (선택) self-healing-ci.sh PASS·BTY_RELEASE_GATE_CHECK 동기. **264 files / 2067 tests** · Build PASS.

**Notes:** **2026-03-18** **`58b8342`** Gate PASS·본 문서·SPRINT_LOG 반영. C5 TASK1: Journey/bounce-back IA **잠금 완료** (`JOURNEY_BOUNCEBACK_IA.md`, `JOURNEY_NAV_WIREFRAME.md`) — 구현 착수 가능. **CONTINUE(C2):** TASK1·2 [x] — **미체크 없음·중단.** **CONTINUE(C2) 재호출:** 동일·중단. **CONTINUE(C2) 3:** 동일·중단.

---

## C3 — DOMAIN ENGINEER

**Allowed:** `src/domain/`, `src/lib/bty/arena/`

**Tasks:**
- [x] [Q3] **주간 경쟁:** **스테이지(티어) 표시** 라벨 키 1건(+테스트) — render-only.
- [x] [Q3] **대시보드:** **LE 진행도** 표시 퍼센트 **캡(0–100)** 상수 1건(+테스트).
- [x] [Q3] **Arena:** **시나리오 코드** 형식 검증 순수 함수 1건(+테스트) — 잘못된 ID 거부.
- [x] [Q4] **Healing:** **진행 불가(쿨다운 등)** 사용자 메시지 키 1건(+테스트).
- [x] [DOCS] **251** barrel·`arena-domain-rules` 1줄.

**Notes:** 251 C3 완료: `weeklyCompetitionStageTierBandDisplayLabelKey`; `clampDashboardLeProgressDisplayPercent`; `isValidArenaScenarioCodeId`; `healingPathProgressBlockedUserDisplayKey`·phase 키; §251.

---

## C4 — API ENGINEER

**Allowed:** `src/app/api/`, `src/middleware.ts`

**Tasks:**
- [x] [Q3] **POST arena/run/complete** **409** JSDoc·에러 본문 1블록.
- [x] [Q3] **GET arena/core-xp** **401** JSDoc 1블록.
- [x] [Q3] **GET me/access** **401** JSDoc 1블록.
- [x] [Q4] **GET bty/healing/progress** 또는 **healing/progress** **404** JSDoc 1블록.
- [x] [API] ARENA_DOMAIN_SPEC §4·**251** 정합.

**Notes:** 251 C4: run/complete·core-xp·me/access·healing progress·스펙. **251 C4 [1–5] 완료:** run/complete 409 `RUN_ABORTED`·core-xp/me/access/healing JSDoc·§4·게이트 251 정합(409=aborted).
- **CONTINUE(C4) Journey IA:** `POST /api/journey/bounce-back` `@contract`·§4-11b·Bearer|쿠키 명시(C5 Comeback은 필요 시 `credentials: 'include'` 병행).
- **251 종료 (C4):** 추가 API 태스크 없음. **252** = C1 splint 후 C4 열.

---

## C5 — UI ENGINEER

**Allowed:** `src/app/[locale]/`, `src/components/`

**Tasks:**
- [x] [Q3] Journey·bounce-back — Growth sub-nav (Dojo·Integrity·Guidance·Journey) + `/growth/journey` JourneyBoard; global Comeback → Resume Journey + POST bounce-back; Reflection → dear-me; IA 문서 준수.
- [x] [Q3] **대시보드:** **LE 진행도** 바·퍼센트 render-only(도메인 캡).
- [x] [Q3] **주간 경쟁:** **스테이지** 라벨 render-only(도메인 키).
- [x] [Q4] **Healing:** **진행 불가** 토스트·인라인 메시지(render-only; 도메인 키).
- [x] [UI] **i18n:** LE 진행·스테이지·Healing 메시지 en/ko.

---

### C5 TASK1 — Journey / Comeback Flow (UI & Navigation)

#### Previous Status

BLOCKED

#### Reason for Blocker

Journey (28-day recovery loop) and bounce-back behavior were not clearly defined at the product IA/UX level.

Specifically, the following were undefined:

- Where Journey should live in the navigation structure
- When and how users enter Journey
- What bounce-back represents (event vs score vs progression)
- Whether comeback affects XP, leaderboard, or season logic
- Whether Journey resets or continues after inactivity

This ambiguity prevented UI and navigation implementation.

---

#### Resolution

The blocker is resolved by locking the Journey and bounce-back IA/UX definition.

See:

- docs/JOURNEY_BOUNCEBACK_IA.md
- docs/JOURNEY_NAV_WIREFRAME.md
- docs/JOURNEY_COMEBACK_UX_SPEC.md

**Key decisions:**

- Journey is part of Growth (not Arena, not My Page, not top-level nav)
- Journey is a recovery loop, not a gameplay or dashboard feature
- Entry via:
  - comeback trigger (3+ days inactivity)
  - Growth menu
  - deep link
- bounce-back is a recovery event only
  - no XP impact
  - no leaderboard impact
  - no season impact
- bounce-back is recorded on "Resume Journey" action only
- default progression = continue from current_day
- no forced reset
- restart is optional and user-initiated only
- Journey UI follows calm, observational tone (no reward/punishment framing)

---

#### Current Status

**READY FOR IMPLEMENTATION** — *SPRINT 251에서 C5 TASK1 구현 완료 `[x]`; 본 절은 해제 근거·스코프 기록(복붙·이관용).*

---

#### Implementation Scope (C5 TASK1)

**Frontend:**

- Comeback modal UI + behavior
- JourneyBoard screen
- Journey step screen
- Growth → Journey entry
- Deep link handling

**Integration:**

- Connect Resume Journey → `POST /api/journey/bounce-back`
- Use `GET /api/journey/profile` for current_day and status

**Constraints:**

- Do not expose bounce_back_count as competitive stat
- Do not connect Journey to XP, leaderboard, or season UI
- Do not introduce forced reset behavior

---

#### Outcome

C5 TASK1 is unblocked and can proceed with UI and navigation implementation based on the locked IA and UX policy.

---

**Notes:** 루트 `bty-arena/page.tsx` 수정 금지. **251 C5 TASK1–5 [x].**
- **CONTINUE(C5) 2026-03-18:** TASK1 완료 — `growth/page` sub-nav·`growth/journey`·`Comeback`(locale layout)·`JourneyBoard variant=growth`·i18n en/ko.
- **CONTINUE(C5):** 미체크 Task 없음 — SPRINT **251** C5 전원 `[x]`; **252**는 C1 splint 후 본 문서 갱신까지 대기.
- **CONTINUE(C5) 재호출:** 동일 — C5 표준 Task `[ ]` 없음·중단.
- [2–5] 완료: `LeStageWidget`+`clampDashboardLeProgressDisplayPercent`; `weeklyCompetitionStageTierBandDisplayLabelKey`+`weeklyCompetitionStageBandCopy`; `ACT_PREREQUISITE`/`COOLDOWN_ACTIVE`+`healingPathProgressBlockedCopy`; i18n.

**Blockers:** —

---

## C6 — TESTFIX ENGINEER

**Tasks:**
- [x] [Q3] **`npm run test:q237-smoke`** 회귀.
- [x] [Q3] **POST arena/run/complete** **409** route.test 1건(짝).
- [x] [TEST] **GET arena/core-xp** **401** route.test 1건.
- [x] [TEST] C3 **251** LE 캡·시나리오·Healing 키 엣지 1건.
- [x] [TEST] npm test·npm run build 녹색·플랜 반영.

**Notes:** 251 C6 완료: q237-smoke; run/complete `meta.aborted_at`→409 RUN_ABORTED+401 짝; core-xp 연속 401; barrel 251 LE 하한·시나리오 빈문자 거부; test+build PASS.

---

## C7 — INTEGRATOR

도구: `./scripts/self-healing-ci.sh` (bty-app; repo 루트 `./scripts/…` 없으면 `bty-app`에서 실행)

- **lint:** PASS
- **test:** PASS
- **build:** PASS
- **overall:** PASS
- **Owner to fix:** —

**Last run:** 2026-03-21 — `bty-app/scripts/self-healing-ci.sh` · lint PASS · test PASS · build PASS · overall PASS · Owner to fix: — · (**346 files** / **2528 tests**) (S343 / S137 · C7 GATE; carry **`346/2528`** · Gate **137**).

---

## BLOCKERS

- *(없음 — C5 TASK1 Journey·bounce-back 구현 완료.)*

---

## 다음 스프린트 (253)

**252** 진행 중 — 상단 **SPRINT 252** `[ ]` 완료 후 C1 splint로 **253**·보드 이번 런 10행 생성.

**REFRESH (252→253):** splint 후 First Task(통상 C5 Release Gate 또는 C2 배포 Gate)부터 표 잠금.

**REFRESH 명령(운영)**: **refresh** 요청 시 `docs/agent-runtime/REFRESH_PROCEDURE.md` — 이번 태스크 점검 → **C2~C6 각 작업 5개** 인라인 → 각 Cursor가 서류 확인 후 해당 열만 진행.


---

## HANDOFFS

- **REFRESH (C1):** **246→247.** runs cursor·profile 422·elite 캐시·Healing 409·UI 페이지네이션·SLA·공유 스텁.
- **REFRESH (C1):** **247→248.** 리더보드 계약·dashboard·journey·center letter·UI 티어·런 상태·Healing 진행·테스트.
- **REFRESH (C1):** **248→249.** C3·C4·C5(2~5)·C6 [x]. C2·C5 TASK1 BLOCKER만. 249 배치 생성.
- **REFRESH (C1):** **249→250.** run 404·profile·leaderboard 401·center resilience·UI tie·빈추천·레벨·테스트.
- **REFRESH (C1):** **250→251.** run/complete 409·core-xp·me/access·healing progress·LE 캡·스테이지·Healing UI·테스트.
- **REFRESH (C1):** **251** — C3·C4·C5(2–5)·C6·C2 Gate [x]. C5 TASK1 IA 잠금·구현 진행. **252** 대기(C1 splint).
- **push:** 배포 후 C2 → REFRESH.

---

## 워커별 다음 작업 5건 (251) — **아카이브(계획 시트)**

251 비-BLOCKER 태스크는 상단 C3–C6 본문과 동일하게 **[x]**. **다음 실무 큐 = 252** (C1이 생성·본 표 교체).

| # | **C2** | **C3** | **C4** | **C5** | **C6** |
|---|--------|--------|--------|--------|--------|
| 1 | Gate(배포 시) | 주간 스테이지 키 | run/complete 409 | Journey·Growth·IA (`JOURNEY_*`) | q237-smoke |
| 2 | self-healing-ci | LE 진행 캡 | core-xp 401 | LE 바 | run/complete 409 test |
| 3 | — | 시나리오 검증 | me/access 401 | 스테이지 라벨 | core-xp 401 test |
| 4 | — | Healing 메시지 키 | healing progress 404 | Healing 토스트 | C3 251 엣지 |
| 5 | — | barrel·251 | SPEC §4·251 | i18n | test·build |

---

## 참고

- docs/JOURNEY_BOUNCEBACK_IA.md · docs/JOURNEY_NAV_WIREFRAME.md · docs/JOURNEY_COMEBACK_UX_SPEC.md (Journey·comeback)
- docs/CURRENT_TASK.md · docs/CURSOR_TASK_BOARD.md · docs/BTY_RELEASE_GATE_CHECK.md
- docs/BTY_MULTI_CURSOR_DOC_HANDOFF.md · docs/BTY_ARENA_UX_DOC_INDEX.md
- docs/ROADMAP_Q3_Q4.md · docs/MVP_DEPLOYMENT_READINESS.md
s/BTY_ARENA_UX_DOC_INDEX.md
- docs/ROADMAP_Q3_Q4.md · docs/MVP_DEPLOYMENT_READINESS.md
EADINESS.md
Q3_Q4.md · docs/MVP_DEPLOYMENT_READINESS.md
EADINESS.md
 docs/MVP_DEPLOYMENT_READINESS.md
EADINESS.md
md
EADINESS.md
 docs/MVP_DEPLOYMENT_READINESS.md
EADINESS.md
.md
S.md
 docs/MVP_DEPLOYMENT_READINESS.md
EADINESS.md
.md
.md
