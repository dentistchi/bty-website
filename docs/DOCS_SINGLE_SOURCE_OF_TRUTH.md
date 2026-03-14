# 문서 단일 진실 (Docs Single Source of Truth)

**프로젝트 규칙**: 아래를 준수한다.

---

## DOCS SINGLE SOURCE OF TRUTH

**루트 `docs/`는 운영 문서의 단일 진실이다.**

다음 문서는 **반드시 루트 `docs/`만** 참조한다.

- `docs/CURSOR_TASK_BOARD.md`
- `docs/CURRENT_TASK.md`
- `docs/NEXT_BACKLOG_AUTO4.md`
- `docs/NEXT_PROJECT_RECOMMENDED.md`
- `docs/BTY_RELEASE_GATE_CHECK.md`

**`bty-app/docs/`는 앱 내부 기술 문서 전용이다.**

---

## 규칙 (한 줄 요약)

- **운영 문서는 루트 `docs/`가 단일 진실이다.**
- **앱 내부 기술 문서는 `bty-app/docs/`에 둔다.**
- **같은 목적의 문서를 두 위치에 중복 유지하지 않는다.**
- **새 문서를 만들 때**: 먼저 운영 문서인지, 앱 내부 기술 문서인지 분류한 뒤 저장 위치를 결정한다.

---

## 단일 진실 기준

- **루트 `docs/`** — 프로젝트 운영의 **단일 진실**이다.  
  에이전트 운영, 보드, 계획, 스펙, 실행 규칙이 여기만 있다.

- **`bty-app/docs/`** — **앱 내부 기술 문서 전용**이다.  
  CONTEXT, ENVIRONMENT, auth/deploy/runtime, Supabase/OpenNext/Cloudflare 등 코드 바로 옆에 두는 문서만 둔다.

---

## 배치 원칙

| 목적 | 위치 |
|------|------|
| 보드, CURRENT_TASK, backlog, agent-runtime | **루트 `docs/`** 에만 둔다. |
| architecture, plans, specs, execution | **루트 `docs/`** 에만 둔다. |
| CONTEXT, ENVIRONMENT, auth/deploy/runtime 체크리스트 | **`bty-app/docs/`** 에 둔다. |

**동일한 목적의 문서를 두 위치에 중복 유지하지 않는다.**

**매번 작업 완료 시 서류 반영:** 태스크·검증·문서 점검이 완료될 때마다 루트 `docs/`의 다음 서류에 **반드시** 추가·갱신한다.  
→ **CURSOR_TASK_BOARD.md** (TASK [x] 완료, 이전 런 완료 한 줄) · **CURRENT_TASK.md** ([x] 완료, 상단 완료 한 줄) · **BTY_RELEASE_GATE_CHECK.md** (Release Gate/VERIFY 시 §2·[VERIFY]·최근 완료) · **ELITE_3RD_SPEC_AND_CHECKLIST.md** (엘리트 3차 검증 시 §3) · **NEXT_PHASE_AUTO4 / NEXT_BACKLOG_AUTO4** (문서 점검 시).  
상세: `docs/CURSOR_TASK_BOARD.md` § "매번 작업 완료 시 서류 반영", `docs/BTY_DEV_OPERATING_MANUAL.md` §6.

---

## C1 / 에이전트

- C1 Commander는 **루트 `docs/`** 만 읽는다 (CURSOR_TASK_BOARD, CURRENT_TASK, NEXT_PHASE_AUTO4, architecture, plans, specs, execution).
- 보드·CURRENT_TASK가 두 군데 있으면 Auto Loop가 꼬이므로, **반드시 루트 `docs/` 한 곳만** 사용한다.

---

*이 규칙은 MIGRATION_LAYOUT 및 역할 분리형 단일 진실 확정 결과를 반영한 것이다.*
