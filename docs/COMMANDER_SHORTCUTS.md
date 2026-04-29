# BTY COMMANDER SHORTCUTS

이 문서는 Commander(C1)가 반복적으로 사용할 단축 명령 모음이다.  
Commander는 항상 동일한 출력 형식으로 응답한다.

---

## 출력 형식 고정

1. First Task
2. Start / Exit Table
3. C2 Prompt
4. C3 Prompt
5. C4 Prompt
6. C5 Command
7. Verify Command

---

## COMMANDER OUTPUT FORMAT LOCK

아래 내용을 Commander 첫 메시지에 1회 넣는다.

```text
BTY COMMANDER OUTPUT FORMAT LOCK

항상 아래 순서와 형식으로만 답한다.

1) First Task
2) Start / Exit Table
3) C2 Prompt
4) C3 Prompt
5) C4 Prompt
6) C5 Command
7) Verify Command

규칙:
- C2 C3 C4는 병렬 우선
- C5는 마지막 Gate
- UI는 render-only
- 도메인 규칙은 src/domain 또는 src/lib/bty/arena 에만 존재
- 불필요한 설명 금지
```
