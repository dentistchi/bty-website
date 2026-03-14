# BTY AI AUTO TASK ENGINE

이 문서는 BTY 프로젝트에서 Commander(C1)가  
자동으로 다음 작업을 찾고  
Workers(C2, C3, C4)에 작업을 분배하도록 하는 엔진이다.

**Commander는 항상 이 규칙을 따른다.**

---

## 1. TASK DISCOVERY

Commander는 **START** 명령을 받으면 다음 순서로 작업을 탐색한다.

1. lint 에러  
2. test 실패  
3. build 실패  
4. Release Gate FAIL  
5. TODO / FIXME  
6. 새 기능 미완료  
7. 문서 업데이트  

**가장 위 항목이 First Task가 된다.**

---

## 2. PRIORITY SYSTEM

**우선순위 규칙**

1. Auth / Session / Redirect  
2. API Contract  
3. Domain Logic  
4. UI  
5. Docs  

---

## 3. AUTO TASK SPLIT

Commander는 First Task를 다음 방식으로 분할한다.

| Cursor | 담당 |
|--------|------|
| **C2** | Gate 검사 |
| **C3** | Domain/API 작업 |
| **C4** | UI 작업 |

---

## 4. PARALLEL EXECUTION

**C2 · C3 · C4** — 항상 병렬 실행한다.

---

## 5. START TRIGGERS

| Cursor | Trigger |
|--------|---------|
| **C1** | 항상 시작 |
| **C2** | C1 계획 완료 |
| **C3** | C1 계획 완료 |
| **C4** | C1 계획 완료 |
| **C5** | C2 C3 C4 완료 |

---

## 6. EXIT CONDITIONS

| Cursor | Exit 조건 |
|--------|-----------|
| **C1** | CURRENT_TASK 업데이트 |
| **C2** | Gate 검사 완료 |
| **C3** | npm test 통과 |
| **C4** | tsc --noEmit 통과 |
| **C5** | npm run lint, npm test, npm run build |

---

## 7. COMMAND OUTPUT FORMAT

Commander는 항상 아래 형식으로 출력한다.

1. First Task  
2. Start / Exit Table  
3. C2 Prompt  
4. C3 Prompt  
5. C4 Prompt  
6. C5 Command  
7. Verify Command  

---

## 8. INTEGRATION

C5는 항상 아래 명령을 실행한다.

```bash
npm run lint && npm test && npm run build
```

또는

```bash
./scripts/self-healing-ci.sh
```

---

## 9. AUTO LOOP

**작업 흐름**

```
START
  ↓
Commander Task 생성
  ↓
C2 C3 C4 병렬 실행
  ↓
VERIFY
  ↓
C5 실행
  ↓
WRAP
```

---

## 10. SELF HEALING

- lint 실패 → 수정  
- test 실패 → 수정  
- build 실패 → 수정  
- `scripts/self-healing-ci.sh` 실행  

---

## 11. COMMANDS

Commander가 인식하는 명령

| 명령 | 의미 |
|------|------|
| **START** | 새 작업 생성 |
| **STATUS** | 현재 진행 상태 출력 |
| **VERIFY** | Exit 조건 확인 |
| **WRAP** | 작업 종료 |

---

# END
