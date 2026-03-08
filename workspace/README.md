# Workspace

루트 `workspace/` 에서 열 작업용으로 쓰는 VS Code / Cursor workspace 파일들.

| 파일 | 용도 |
|------|------|
| **bty-dev.code-workspace** | Arena, Center, Foundry, API, UI, Domain, Agent 작업 — `bty-app` 폴더만 열림 |
| **bty-docs.code-workspace** | ARCHITECTURE_MAP, FEATURE_PIPELINE, TASK_MEMORY, SPEC, ROADMAP — `docs` 폴더만 열림 |
| **bty-infra.code-workspace** | CI, deploy, workflow, scripts, database — `.github`, `scripts`, `supabase` 폴더 열림 |

**사용**: 루트에서 `code workspace/bty-dev.code-workspace` 또는 Cursor에서 해당 파일 열기. 상대 경로 `../` 는 **루트(bty-project)** 기준이므로, 반드시 **루트를 기준으로** workspace 파일을 연다.
