# Cursor Rules → Claude Code 마이그레이션 가이드

## 결과 요약

- **23개 룰 → 8 rules + 7 commands + 2 agents**
- **빈 파일 1개 삭제** (`bty-core.mdc`)
- **`CLAUDE.md` 강화** — 인바리언트를 최상단으로
- **Hooks로 결정적 강제** — interpretArenaDecision, QR route 수정 시 경고

---

## 무엇이 어디로 갔나 (전체 매핑)

### CLAUDE.md (최상위 통합)

| 원본 | 통합 위치 |
|---|---|
| `00-bty-core.mdc` | CLAUDE.md "Non-negotiable Invariants" |
| `bty-arena-global.mdc` 인바리언트 | CLAUDE.md "Non-negotiable Invariants" |
| `bty-task-completion-docs.mdc` | CLAUDE.md "Task Completion Discipline" |

### `.claude/rules/` (path-scoped, lazy-load)

| 원본 → 통합 후 |
|---|
| `bty-import-direction` + `bty-layer-import` + `bty-system-boundary` → **`architecture.md`** |
| `bty-domain-pure-only` → **`domain-purity.md`** |
| `bty-service-layer` → **`service-layer.md`** |
| `bty-api-thin-handler` → **`api-handlers.md`** |
| `bty-ui-render-only` → **`ui-render-only.md`** |
| `bty-chat-boundary` → **`chat-boundary.md`** |
| `bty-arena-data` + `30-sql-migration` + `sql-copy-friendly` → **`migrations.md`** |
| `bty-auth-deploy-safety` + `bty-release-gate` → **`release-safety.md`** |

### `.claude/commands/` (슬래시 명령으로 승격)

| 원본 → 명령 |
|---|
| `10-bug-analyze` → `/bug-analyze` |
| `20-bug-fix-minimal` → `/bug-fix` |
| `40-test-safe-change` → `/test-safe-change` |
| `bty-c5-verify` → `/c5-verify` (+ subagent) |
| `bty-auto4-prompts-inline` → `/auto4-prompts` |
| `bty-continue-read-board` → `/continue` + `/refresh` (둘로 분리) |

### `.claude/agents/` (격리된 컨텍스트)

| 원본 → 에이전트 |
|---|
| `c1-commander` → `c1-commander` (Edit/Write 도구 의도적 제외) |
| `bty-c5-verify` → `c5-verify` (검증 전문) |

### `.claude/settings.json` (결정적 hooks)

- `Edit/Write` on `interpretArenaDecision` → ⚠️ 경고
- `Edit/Write` on `/api/qr` 라우트 → ⚠️ 경고
- `.ts/.tsx` 수정 → 자동 terminology validator
- `src/domain/*.ts` 수정 → purity 리마인더
- `supabase/migrations/*.sql` 수정 → idempotent/separation 리마인더

### 삭제

- `bty-core.mdc` — 0바이트 빈 파일

---

## 적용 방법 (단계별)

### 1단계: 백업

```bash
cd <btytrainingcenter 루트>
cp -r .cursor/rules .cursor/rules.backup-$(date +%Y%m%d)
cp .cursorrules .cursorrules.backup-$(date +%Y%m%d) 2>/dev/null || true
```

### 2단계: 새 구조 적용

이 가이드와 함께 받은 파일들을 프로젝트 루트에 복사합니다:

```
btytrainingcenter/
├── CLAUDE.md                          ← 새 버전 (기존 것 백업 후 교체)
├── .claude/
│   ├── settings.json                  ← 새로 생성
│   ├── rules/
│   │   ├── architecture.md
│   │   ├── domain-purity.md
│   │   ├── service-layer.md
│   │   ├── api-handlers.md
│   │   ├── ui-render-only.md
│   │   ├── chat-boundary.md
│   │   ├── migrations.md
│   │   └── release-safety.md
│   ├── commands/
│   │   ├── bug-analyze.md
│   │   ├── bug-fix.md
│   │   ├── test-safe-change.md
│   │   ├── c5-verify.md
│   │   ├── auto4-prompts.md
│   │   ├── continue.md
│   │   └── refresh.md
│   └── agents/
│       ├── c1-commander.md
│       └── c5-verify.md
├── .cursor/rules/                     ← 그대로 유지 (Cursor 호환성)
└── .cursorrules                       ← 그대로 유지
```

### 3단계: Cursor에서 만든 Skills/Subagents 복사

이미지에서 본 Skills 5개와 Subagents 6-7개:

```bash
# Cursor가 어디 저장하는지 먼저 확인
ls -la .cursor/skills/ 2>/dev/null
ls -la .cursor/agents/ 2>/dev/null

# 또는 글로벌 위치
ls -la ~/.cursor/skills/ 2>/dev/null
ls -la ~/.cursor/agents/ 2>/dev/null

# 발견되면 .claude로 복사
mkdir -p .claude/skills
cp -r .cursor/skills/* .claude/skills/ 2>/dev/null || true
cp -r .cursor/agents/* .claude/agents/ 2>/dev/null || true
```

⚠️ Cursor 2.4의 SKILL.md 형식은 Claude Code와 호환됨 — 그대로 작동할 가능성 높음.
복사 후 1-2개 열어서 YAML frontmatter 확인.

### 4단계: 검증

```bash
cd bty-app
claude  # Claude Code 실행

# 첫 명령으로 테스트
> /continue
> 현재 어떤 룰이 로드되었어?
```

Claude Code가 path-scoped 룰을 자동으로 인식해야 함. 만약 인식 안 하면 frontmatter `paths:` 형식 점검.

---

## 의도적으로 강화한 부분

### 1. 인바리언트가 더 잘 보임

원본은 23개 파일에 흩어져 있었음. 이제는 `CLAUDE.md` 최상단에 **Non-negotiable Invariants** 섹션으로 모임. 매 세션 자동 로드됨.

### 2. Hook으로 결정적 강제

원본 룰은 권고 수준 (Claude가 80% 정도 따름). 핵심 인바리언트는 hook으로 박았음:
- `interpretArenaDecision` 건드리면 자동 경고
- QR validation route 수정 시 자동 경고
- domain 폴더 수정 시 자동 리마인더
- migration 만들 때 자동 리마인더

### 3. 룰과 명령의 분리

`10-bug-analyze`, `20-bug-fix-minimal`, `40-test-safe-change`는 원본에서 `alwaysApply: false`인데 globs도 없어서 거의 발동 안 되고 있었을 것. **명령으로 승격**해서 사용자가 명시적으로 호출하게 됨.

### 4. C1 Commander 에이전트화

원본은 룰 파일이라 Claude가 일반 작업하면서 페르소나가 섞임.
**격리된 subagent**로 분리하면:
- 메인 컨텍스트 깨끗하게 유지
- Edit/Write 도구 의도적 제외 → "코드 수정 안 함" 규칙이 도구 레벨에서 강제됨
- `Task` 도구로 명시적 호출

### 5. 여전히 `.cursor/rules/` 보존

지우지 않음:
- 다른 팀원이 Cursor 쓸 수 있음
- 백업 가치
- Cursor가 `~/.claude/`도 자동 인식하므로 양쪽 동기화 가능

---

## 주의 사항

### 운영 문서 갱신은 hook이 아니라 가이드

원본에서 가장 강하게 강제하던 "작업 완료 시 보드/CURRENT_TASK 갱신"은 **hook으로 만들기 어려움** (어떤 작업이 "완료"인지 자동 판단 불가). 대신:

1. `CLAUDE.md`에 명시 ("Task Completion Discipline" 섹션)
2. `/c5-verify` 명령에 명시
3. `c5-verify` subagent에 명시

→ Claude가 매번 따른다는 보장은 없으나, 컨텍스트에 강하게 자리잡음.

**보강 방법**: 작업 끝낼 때마다 `/c5-verify` 호출하는 습관. C5 agent는 운영 문서 갱신을 자기 책임으로 가짐.

### 룰을 줄였지만 정보 손실은 거의 없음

- 23개 → 17개 (rules 8 + commands 7 + agents 2)
- 통합 과정에서 모든 룰 텍스트 보존
- 중복만 제거 (`30-sql-migration` 내용은 `migrations.md`로 흡수)
- 단지 "어디서 발동되는지"가 명시화됨

### 첫 주는 검증 모드

다음 일주일간 작업하면서:
- Claude가 어떤 룰을 어기는지 메모
- 어긴 룰이 hook으로 만들 수 있는 것이면 settings.json에 추가
- 한 번도 발동 안 되는 룰은 path 범위 재검토

---

## 추가로 검토할 것

### 1. 기존 Cursor Skills 호환성

스크린샷에서 본 5개 Skills (api-contract-from-ui, bty-arena-change-review, evaluate-migration-safety, feature-request-impact-analysis, refactor-code-constraints)는 **Claude Code SKILL.md 형식과 거의 호환**. 복사 후 frontmatter만 점검.

### 2. 6-7개 Subagents

bty-arena-data-engineer, bty-arena-rules, bty-arena-ui, bty-auth-deploy-safety, bty-domain-architect 등도 그대로 옮겨짐. 이번 마이그레이션에서 새로 만든 `c1-commander`, `c5-verify`와 충돌 없는지 확인 (이름 겹치지 않음).

### 3. `bty-auth-deploy-safety` 충돌

룰 파일과 subagent 둘 다 있음:
- 룰 → `.claude/rules/release-safety.md`로 통합됨
- subagent → 그대로 둠 (Cursor에서 이미 사용 중)

이 두 개는 역할이 다르므로 공존 가능:
- 룰: 모든 auth/deploy 관련 코드에 적용
- subagent: 명시적으로 위임할 때 사용

---

## 다음 단계

1. ✅ 파일 적용
2. `claude` 실행해서 테스트
3. `/continue` 명령 테스트
4. 기존 Cursor Skills 5개 복사 시도
5. 일주일 운영 후 hooks 보강
