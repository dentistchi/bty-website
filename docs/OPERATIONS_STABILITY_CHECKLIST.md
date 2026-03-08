# 운영 자동화 안정화 체크리스트

**목적**: 경로 잔재 제거 + 운영 안정화. 이 순서대로 하면 C1 자동 루프가 깨지지 않는다.

---

## 1. .cursor/rules/*.mdc 경로 잔재 제거

**기준**: 다음 운영 문서는 **repo root `docs/`** 만 참조한다.

| 기존 경로 | 새 경로 |
|-----------|---------|
| bty-app/docs/CURSOR_TASK_BOARD.md | docs/CURSOR_TASK_BOARD.md |
| bty-app/docs/CURRENT_TASK.md | docs/CURRENT_TASK.md |
| bty-app/docs/NEXT_BACKLOG_AUTO4.md | docs/NEXT_BACKLOG_AUTO4.md |
| bty-app/docs/NEXT_PROJECT_RECOMMENDED.md | docs/NEXT_PROJECT_RECOMMENDED.md |
| bty-app/docs/BTY_RELEASE_GATE_CHECK.md | docs/BTY_RELEASE_GATE_CHECK.md |
| bty-app/docs/architecture/* | docs/architecture/* |
| bty-app/docs/plans/* | docs/plans/* |
| bty-app/docs/specs/* | docs/specs/* |
| bty-app/docs/execution/* | docs/execution/* |

**점검**: `.cursor/rules/` 아래 모든 `.mdc`에서 위 "기존 경로"가 있으면 "새 경로"로 수정.

---

## 2. CI / 스크립트의 bty-app/docs/... 참조 제거

**검사 명령** (프로젝트 루트에서):

```bash
grep -R "bty-app/docs/CURSOR_TASK_BOARD\|bty-app/docs/CURRENT_TASK\|bty-app/docs/NEXT_BACKLOG_AUTO4\|bty-app/docs/NEXT_PROJECT_RECOMMENDED\|bty-app/docs/BTY_RELEASE_GATE_CHECK" .cursor .github scripts docs bty-app 2>/dev/null
```

- **0건**이면 통과.  
- **1건 이상**이면 해당 파일에서 위 표 기준으로 `docs/...` 로 치환.

**예외**: `bty-app/docs/CONTEXT.md`, `bty-app/docs/ENVIRONMENT.md` 등 **앱 내부 기술 문서**는 bty-app/docs 유지 (CI·README 등에서 참조 가능).

---

## 3. C1 최종 프롬프트에 "루트 docs 단일 진실" 규칙 반영

- **C1_COMMANDER_HANDOFF.md**, **AGENT_ORCHESTRATOR_PROMPT.md**, **docs/agent-runtime/AUTO4_PROMPTS.md** 등 C1이 읽는 문서에 아래 문장이 포함되어 있는지 확인:
  - **보드·CURRENT_TASK·backlog·architecture·plans·specs·execution·Release Gate** 는 **루트 `docs/`** 단일 진실.
  - **bty-app/docs/** 는 앱 내부 기술 문서 전용.

---

## 4. 일괄 치환 (필요 시)

**프로젝트 루트**에서만 실행. 먼저 `grep -rl` 로 대상 파일 확인 후 적용.

```bash
# 운영 문서 5개만 치환 (bty-app/docs/... → docs/...)
grep -rl "bty-app/docs/CURSOR_TASK_BOARD.md" .cursor .github scripts docs bty-app 2>/dev/null | xargs -I{} sed -i '' 's#bty-app/docs/CURSOR_TASK_BOARD.md#docs/CURSOR_TASK_BOARD.md#g' {}
grep -rl "bty-app/docs/CURRENT_TASK.md" .cursor .github scripts docs bty-app 2>/dev/null | xargs -I{} sed -i '' 's#bty-app/docs/CURRENT_TASK.md#docs/CURRENT_TASK.md#g' {}
grep -rl "bty-app/docs/NEXT_BACKLOG_AUTO4.md" .cursor .github scripts docs bty-app 2>/dev/null | xargs -I{} sed -i '' 's#bty-app/docs/NEXT_BACKLOG_AUTO4.md#docs/NEXT_BACKLOG_AUTO4.md#g' {}
grep -rl "bty-app/docs/NEXT_PROJECT_RECOMMENDED.md" .cursor .github scripts docs bty-app 2>/dev/null | xargs -I{} sed -i '' 's#bty-app/docs/NEXT_PROJECT_RECOMMENDED.md#docs/NEXT_PROJECT_RECOMMENDED.md#g' {}
grep -rl "bty-app/docs/BTY_RELEASE_GATE_CHECK.md" .cursor .github scripts docs bty-app 2>/dev/null | xargs -I{} sed -i '' 's#bty-app/docs/BTY_RELEASE_GATE_CHECK.md#docs/BTY_RELEASE_GATE_CHECK.md#g' {}
```

---

## 5. 다음: health → MODE → 다음 작업 진행 → auto 루프 고정

- Health Check 후 MODE 설정.
- C1이 **루트 docs/** 만 읽고 First Task 선정 → C2~C5 디스패치 → 검증 → wrap → auto 루프.

---

**규칙 요약**  
- 루트 `docs/` = 프로젝트 운영 단일 진실.  
- `bty-app/docs/` = 앱 내부 기술 문서 전용.  
- 동일 목적 문서 중복 금지. 새 문서는 운영 vs 앱 내부 분류 후 저장 위치 결정.
