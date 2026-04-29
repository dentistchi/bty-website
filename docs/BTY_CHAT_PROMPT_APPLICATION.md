# BTY Chat — 프롬프트 적용 방식

## GLOBAL OVERRIDE

`[BTY CHAT — GLOBAL OVERRIDE (DO NOT REMOVE)]` 블록은 **기존 시스템 프롬프트를 대체하지 않고**, 시스템 메시지 **최상단에서 우선 적용**되는 공용 규칙입니다.

- 위치: `src/lib/bty/chat/buildChatMessages.ts` → `BTY_CHAT_GLOBAL_OVERRIDE`
- 내용: 모드 규칙, 응답 고정 패턴(요약→질문→다음 행동), 톤/금지 표현, 메타 질문 대응, 언어. EN mirror 포함.

## 완전 드롭인 (타입 + 메시지 조합)

`src/lib/bty/chat/` 모듈로 다음을 제공합니다.

- **타입** (`types.ts`): `ChatRequestBody`, `ChatResponseBody`, `OpenAIChatMessage`, `ChatMode`
- **메시지 조합** (`buildChatMessages.ts`): `buildChatMessagesForModel(messages, mode, lang)` → 모델에 넘길 `OpenAIChatMessage[]`
- **모드/폴백**: `normalizeMode(bodyMode, userContent)`, `getFallbackMessage(mode, lang)`
- **가드** (`chatGuards.ts`): `isLowSelfEsteemSignal`, `isDojoRecommendSignal`, `getSafetyValveMessage`, `getDojoRecommendMessage`

**사용 예**

- **우리 API 호출**: body는 `{ messages, mode?, lang? }` (타입은 `ChatRequestBody`). 응답은 `ChatResponseBody`.
- **다른 런타임에서 동일 로직 사용**: `import { buildChatMessagesForModel, normalizeMode, getFallbackMessage } from '@/lib/bty/chat'` 후, 대화 배열 + mode + lang으로 `buildChatMessagesForModel` 호출해 OpenAI 등에 넘기면 됨.

## 적용 의견 (구현 방식)

1. **Override를 상단 고정 상수로 유지**  
   - GLOBAL OVERRIDE 전문을 한 번만 상수로 두고, 수정 시 해당 블록만 교체하면 됨.  
   - 다른 규칙을 “덧붙이는” 형태로 두지 않고, override가 항상 맨 위에 오도록 함.

2. **모드·언어만 하단에 붙이기**  
   - 시스템 메시지 = `BTY_CHAT_GLOBAL_OVERRIDE` + `Current mode: {dearme|dojo|arena}. Apply the rules above.` + `Respond in Korean/English.`  
   - 모드별 추가 지시는 override 안에 이미 정의되어 있으므로, 런타임에는 “현재 모드”와 “언어”만 명시.

3. **Few-shot은 override와 별도 유지**  
   - DOJO/ARENA/DEARME few-shot은 override를 “대체”하지 않고, **같은 패턴을 보여주는 예시**로만 사용.  
   - 메시지 순서: `[system(override + mode + lang), ...fewShotForMode, ...conversationHistory]`

4. **의도 추론은 override 문구와 맞추기**  
   - mode가 없을 때: 감정 안전/불안/자기비난/번아웃/위로 → dearme, 연습/성장/실력/훈련/개선/코칭 → dojo, 의사결정/시뮬/결과/트레이드오프/조직 영향 → arena.  
   - 코드의 `DEARME_SIGNALS`, `DOJO_SIGNALS`, `ARENA_SIGNALS`는 위 규칙과 동일하게 보수적으로 추론.

이렇게 하면 “GLOBAL OVERRIDE는 건드리지 않고, 나머지는 그 아래에서만 확장”하는 구조를 유지할 수 있습니다.

---

## GLOBAL OVERRIDE 점검 및 의견

### 점검 결과 (코드와 비교)

- 코드 상의 `BTY_CHAT_GLOBAL_OVERRIDE` 내용은 규격과 **동일**합니다.
- 1~5항, EN mirror, `[END OVERRIDE]`까지 반영되어 있고, `buildSystemPrompt`에서 이 블록이 항상 최상단에 오도록 되어 있습니다.

### 의견

**잘 잡혀 있는 부분**

- **모드 3분할 + 보수적 추론**: dearme/dojo/arena 역할이 분명하고, mode 없을 때 감정→dearme, 연습→dojo, 의사결정→arena로 넘기는 기준이 명확함.
- **고정 패턴 (요약→질문→다음 행동)**: 모든 모드에 공통이라 모델이 따르기 쉽고, few-shot과도 잘 맞음.
- **모드별 금지 표현**: ARENA 위로/인격 판단, DEARME 경쟁/압박을 구체적으로 적어 두어서 실수 구간을 줄이기 좋음.
- **EN mirror**: 한/영 혼용 입력이나 모델이 영어로 읽을 때도 규칙이 한 번 더 각인됨.

**보완을 고려할 수 있는 부분**

1. **DOJO 금지 표현**  
   현재는 ARENA/DEARME만 “금지”가 있고, DOJO는 “하지 말고 ~하라”만 있음. 필요하면 “DOJO에서 금지: 정서적 위로, 대신 답 내주기”처럼 한 줄을 넣어도 됨. 없어도 톤 설명만으로도 충분할 수 있음.

2. **길이/토큰**  
   Override가 꽤 길어서, 대화 이력 + few-shot과 합치면 컨텍스트를 많이 씀. 나중에 “EN mirror만 남기고 한국어 본문을 짧게 요약”하는 식으로 줄이면 비용·지연을 조금 줄일 수 있음. 지금 구조를 유지하는 쪽이 우선이면 그대로 두어도 됨.

3. **“기존 시스템 프롬프트를 대체하지 않는다”**  
   현재 구현은 이 override만 시스템으로 쓰고 있어서, 사실상 “유일한 시스템 규칙”임. 문서상 “대체하지 않는다”는 의미를 “다른 규칙이 있으면 override가 **우선**한다”로 해석하면, 나중에 짧은 보조 규칙을 아래에 붙여도 충돌하지 않음.

**결론**

- 지금 문단만으로도 **모드 구분, 패턴, 톤/금지, 메타/언어**가 잘 정리되어 있어서 그대로 사용해도 무방함.
- 위 보완은 “선택 사항” 수준이고, 실제 응답을 보면서 DOJO에서 위로/답 대신 내주기가 나오면 그때 DOJO 금지 한 줄을 추가하는 식으로 가도 충분함.
