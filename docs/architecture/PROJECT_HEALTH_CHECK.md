# PROJECT HEALTH CHECK

BTY 프로젝트 상태를 **주기적으로 점검**한다.

---

## Health Check 명령 시 점검 순서

**Health Check** 명령이 오면 다음을 순서대로 점검한다.

1. **Indexing** 상태
2. **Workspace** 상태
3. **Build** 상태
4. **CI** 상태
5. **Docs Sync** 상태

---

## 문제 발견 시

문제가 발견되면 **Fix Task**를 생성한다.

| 발견 문제 | Fix Task 예시 |
|-----------|----------------|
| indexing loop | `[FIX] indexing loop 해결` |
| build error | `[FIX] build error 수정` |
| CI context guard 실패 | `[FIX] CI context guard 수정` |

---

## 점검 항목 상세

Health Check는 다음 항목을 확인한다.

---

## INDEXING

**Cursor Codebase Indexing** 상태 확인

| 상태 | 설명 |
|------|------|
| **정상** | files indexed 표시 |
| **문제** | initializing 상태 지속 |

---

## WORKSPACE

**workspace** 로딩 상태

| 상태 | 설명 |
|------|------|
| **정상** | bty-app workspace 정상 로드 |
| **문제** | index loop 발생 |

---

## BUILD

**프로젝트 빌드** 상태

```bash
npm run build
```

| 결과 | 설명 |
|------|------|
| **성공** | build pass |
| **실패** | build error 발생 |

---

## CI STATUS

**GitHub Actions** 상태

| 상태 | 설명 |
|------|------|
| **정상** | CI PASS |
| **문제** | Context Guard 실패 |

---

## DOC SYNC

**문서 동기화** 상태

확인 파일:

- `docs/CURSOR_TASK_BOARD.md`
- `docs/CURRENT_TASK.md`
- `docs/agent-runtime/TASK_MEMORY.md`

**누락 여부** 확인.
