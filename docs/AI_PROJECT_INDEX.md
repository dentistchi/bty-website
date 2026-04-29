# BTY AI PROJECT INDEX

이 문서는 BTY 프로젝트에서 AI Cursor가 **가장 먼저 읽어야 하는 루트 문서**이다.

**모든 AI는 작업 시작 전에 아래 문서를 순서대로 읽는다.**

---

## STEP 1 — CONTEXT LOCK

**`docs/AI_CONTEXT_LOCK.md`**

| 항목 | 내용 |
|------|------|
| **목적** | 프로젝트의 규칙과 역할을 정의한다. |
| **포함 내용** | Cursor 역할, Domain 원칙, UI 원칙, Auth 규칙, Release Gate |

---

## STEP 2 — MEMORY MAP

**`docs/AI_MEMORY_MAP.md`**

| 항목 | 내용 |
|------|------|
| **목적** | 프로젝트 파일 구조를 이해한다. |
| **포함 내용** | Domain 위치, API 위치, UI 위치, 테스트 위치, 빌드 명령 |

---

## STEP 3 — AGENT GUIDE

**`docs/AGENTS_SHARED_README.md`**

| 항목 | 내용 |
|------|------|
| **목적** | Cursor 역할별 작업 규칙. |
| **포함 내용** | Commander 역할, Worker 역할, Error Check 역할 |

---

## STEP 4 — COMMAND SYSTEM

**`docs/COMMANDER_SHORTCUTS.md`**

| 항목 | 내용 |
|------|------|
| **목적** | Commander 단축 명령. |
| **포함 내용** | RUN_NEXT, STATUS, VERIFY, WRAP |

---

## STEP 5 — RELEASE GATE

**`docs/BTY_RELEASE_GATE_CHECK.md`**

| 항목 | 내용 |
|------|------|
| **목적** | 배포 전 검사. |
| **검사 항목** | Auth, Cookies, Leaderboard, XP, Season, Migration |

---

## STEP 6 — DOMAIN SOURCE

도메인 로직은 **다음 위치에서만** 수정 가능:

- `src/domain/`
- `src/lib/bty/arena/`

**UI에서는 절대 계산하지 않는다.**

---

## STEP 7 — API ENTRY

API는 다음 위치에서 관리:

- `src/app/api/`

---

## STEP 8 — UI ROOT

**UI 루트**

- `src/app/[locale]/`

---

## STEP 9 — BUILD SYSTEM

**빌드 명령**

```bash
npm run lint
npm test
npm run build
```

---

## STEP 10 — DEPLOY CHECK

**Workers 검증**

- `scripts/verify-workers-dev.sh`

---

## CURSOR STRUCTURE

| 역할 | 책임 |
|------|------|
| **C1 Commander** | Plan only |
| **C2 Gatekeeper** | Rule validation |
| **C3 Domain/API** | Server logic |
| **C4 UI** | Frontend |
| **C5 Integrator** | lint, test, build |

---

## EXECUTION GRAPH

```
        C1
         │
  ┌──────┼──────┐
  │      │      │
 C2     C3     C4
Gate    API     UI
  │      │      │
  └──────┴──────┘
         │
         │
        C5
```

---

## OPERATION LOOP

```
START
  → C2 C3 C4 병렬 실행
  → VERIFY
  → C5 실행
  → WRAP
```

---

*모든 Cursor는 이 INDEX를 기준으로 프로젝트를 이해한다.*
