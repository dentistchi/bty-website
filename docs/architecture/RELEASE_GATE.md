# RELEASE GATE

배포 전 **다음 Gate를 통과**해야 한다.

1. **LINT**
2. **TYPECHECK**
3. **BUILD**
4. **INTEGRATION**
5. **DOC SYNC**

---

## GATE 1 — LINT

```bash
npm run lint
```

---

## GATE 2 — TYPECHECK

```bash
npx tsc --noEmit
```

*참고: `npm run lint`가 이미 `tsc --noEmit`을 포함할 수 있음. 프로젝트 스크립트 확인.*

---

## GATE 3 — BUILD

```bash
npm run build
```

---

## GATE 4 — INTEGRATION

- **C5 Integrator** 확인
- **API ↔ UI** 연결 문제 없음

---

## GATE 5 — DOC SYNC

- `docs/CURSOR_TASK_BOARD.md` 업데이트
- `docs/CURRENT_TASK.md` 업데이트
- **TASK_MEMORY** 기록 완료

---

## Gate 실패 시

해당 문제를 수정하는 **작업을 생성**한다.

| 실패 Gate | 작업 예시 |
|-----------|-----------|
| **BUILD** 실패 | → [FIX] build error 수정 |
| **INTEGRATION** 실패 | → C3 또는 C4 수정 작업 생성 |

---

## Gate 통과 시

**READY FOR DEPLOY** 상태.

---

## 통과 기준

위 5개 Gate를 모두 통과한 뒤 배포한다.  
실패 시 해당 Gate 원인 해소 후 다시 1번부터 검증한다.
