# 프로젝트 레이아웃 제안 및 마이그레이션

**상태: 적용 완료.** 역할 분리형 단일 진실(옵션 A)로 이전함.

---

## 최종 규칙 (단일 진실)

- **루트 `docs/`** 는 프로젝트 운영의 **단일 진실**이다.
- **`bty-app/docs/`** 는 **앱 내부 기술 문서 전용**이다.
- 보드, CURRENT_TASK, backlog, agent-runtime, architecture, plans, specs, execution 문서는 **루트 `docs/`** 에만 둔다.
- 동일한 목적의 문서를 두 위치에 중복 유지하지 않는다.

→ 상세: 루트 **docs/DOCS_SINGLE_SOURCE_OF_TRUTH.md**

---

## 적용된 레이아웃

```
bty-project
├─ bty-app
│   ├─ src
│   ├─ docs          ← 앱 전용 문서 (보드·CURRENT_TASK·스펙 등)
│   ├─ package.json
│   └─ .cursorignore
├─ docs              ← 프로젝트 공용 문서
│   ├─ architecture
│   ├─ plans
│   ├─ specs
│   └─ agent-runtime
├─ scripts
├─ supabase
├─ .github
└─ workspace
    ├─ bty-dev.code-workspace
    ├─ bty-docs.code-workspace
    └─ bty-infra.code-workspace
```

---

## (참고) 이전 상태 요약

| 위치 | 내용 |
|------|------|
| **bty-app/docs/** | CURSOR_TASK_BOARD, CURRENT_TASK, NEXT_PHASE_AUTO4, architecture/, plans/, specs/, 수많은 스펙·백로그 md |
| **docs/** (루트) | CURSOR_TASK_BOARD, CURRENT_TASK, NEXT_PHASE_AUTO4, NEXT_PROJECT_RECOMMENDED, agent-runtime/, spec/ |

→ 보드·CURRENT_TASK 등이 **bty-app/docs**와 **루트 docs** 양쪽에 존재할 수 있음. 규칙/문서에서는 `docs/CURSOR_TASK_BOARD.md` 등으로 참조.

---

## 옵션 A: 루트 `docs/`를 단일 진실로 통합

- **루트 docs/** 에 architecture, plans, specs, agent-runtime 유지/이동.
- **bty-app/docs/** 는 **앱만** 사용하는 문서로 한정 (예: 스토리북, Arena 비주얼 스펙, 로컬 테스트 등).
- 보드·CURRENT_TASK·NEXT_PHASE_AUTO4·Release Gate 등은 **한 곳만** 사용 (예: 루트 `docs/` 또는 `bty-app/docs/` 중 하나로 통일).

**이동 예시**
- `bty-app/docs/architecture/*` → `docs/architecture/`
- `bty-app/docs/plans/*` → `docs/plans/`
- `bty-app/docs/specs/*` → `docs/specs/` (기존 루트 `docs/spec`과 통합 여지 있음)
- agent-runtime은 이미 루트 `docs/agent-runtime/` 존재 → 그대로 두거나 bty-app 쪽 내용 병합.

---

## 옵션 B: 제안 구조만 맞추고 경로 유지

- **workspace/** 폴더만 만들고 `*.code-workspace` 모음.
- **루트 docs/** 에 architecture, plans, specs, agent-runtime 폴더만 정리 (이미 있으면 유지).
- **bty-app/docs** 는 그대로 두고, 규칙·문서에서 참조하는 `docs/` 경로를 **bty-app 기준**인지 **루트 기준**인지 명시만 통일.

---

## 이동 시 반드시 갱신할 참조

다음 문서/규칙에서 `docs/...` 경로가 나옴. 이동 후 한 곳으로 통일하면 이 참조들을 그 경로에 맞게 수정해야 함.

- `CURSOR_TASK_BOARD.md` — "docs/CURRENT_TASK.md", "docs/NEXT_PHASE_AUTO4.md", "docs/CURSOR_TASK_BOARD.md"
- `CURRENT_TASK.md` — "docs/CURSOR_TASK_BOARD.md"
- `NEXT_PHASE_AUTO4.md` — "docs/CURSOR_TASK_BOARD.md"(루트 단일 진실)
- `RELEASE_GATE.md` — "docs/CURSOR_TASK_BOARD.md", "docs/CURRENT_TASK.md"
- `PROJECT_HEALTH_CHECK.md` — "docs/CURSOR_TASK_BOARD.md", "docs/CURRENT_TASK.md", "docs/agent-runtime/TASK_MEMORY.md"
- `.cursor/rules/*.mdc` — bty-app/docs 또는 docs 경로 언급 여부 확인

---

## 권장 순서

1. **단일 진실 결정**: 보드·CURRENT_TASK·NEXT_PHASE_AUTO4를 **루트 docs/** vs **bty-app/docs/** 중 하나로 고정.
2. **workspace/** 생성 후 기존 `*.code-workspace` 파일들 이동 (필요 시).
3. **루트 docs/** 아래 architecture, plans, specs, agent-runtime 구성 (이미 있으면 내용만 이동).
4. 위 "갱신할 참조" 목록대로 경로 수정.
5. CI·스크립트에서 `docs/` 또는 `bty-app/docs/`를 쓰는지 확인 후 경로 수정.

원하면 **옵션 A** 기준으로 실제 이동할 파일 목록과 단계별 명령어도 정리해 줄 수 있다.
