---
description: Inline C1–C5 copy-paste prompts from AUTO4_PROMPTS.md
---

# AUTO4 프롬프트 인라인 표시

사용자가 **splint 10**, **AUTO4**, **C1–C5 프롬프트**, 또는 **복사 문장**을 요청했을 때 실행.

## 절차

1. **반드시** `docs/agent-runtime/AUTO4_PROMPTS.md` 를 읽는다
2. C1·C2·C3·C4·C5용 **복사용 문장 블록**을 응답 본문에 **그대로 인라인**으로 넣어 준다

사용자가 별도로 파일을 열지 않아도, 채팅 응답만으로 각 Cursor (또는 Claude Code) 창에 붙여 넣을 수 있게 한다.

## 출력 형식

```
## C1 (Master Commander)
[copy-paste prompt block]

## C2
[copy-paste prompt block]

## C3
[copy-paste prompt block]

## C4
[copy-paste prompt block]

## C5 (Verify)
[copy-paste prompt block]
```

각 블록은 사용자가 그대로 복사해서 다른 창에 붙여넣을 수 있는 형태여야 함.

*출처: `docs/agent-runtime/SPLINT_10_PROCEDURE.md` 3단계, `docs/agent-runtime/AUTO4_PROMPTS.md`*
