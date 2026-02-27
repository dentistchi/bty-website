# Arena 자유 입력(Free Response) 스펙

**목표**: 시나리오에서 "기타 (직접 입력)" 선택 시 사용자 텍스트를 서버로 보내고, 짧은 피드백 + XP를 반환해 기존 선택지 플로우와 동일하게 완료·리더보드에 반영한다.

---

## 1. 언제 발생하는가

- **트리거**: Intermediate/Advanced Arena (`/bty-arena`)에서 **Step 2** 선택 시, 사용자가 **"Other (Write your own)"** 를 누르고 **직접 입력한 텍스트**를 제출할 때.
- **기존 동작**: 현재는 `OTHER_SELECTED` 이벤트만 기록하고 XP 0으로 결과 화면(Step 3)으로 이동.
- **변경 후**: 사용자 입력 텍스트를 `POST /api/arena/free-response`로 보내고, **피드백(praise / suggestion) + XP**를 받아 Step 3에서 표시.

---

## 2. API

### `POST /api/arena/free-response`

**Request (JSON)**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `runId` | string (UUID) | ✅ | 현재 런 ID |
| `scenarioId` | string | ✅ | 시나리오 ID |
| `responseText` | string | ✅ | 사용자 자유 입력 (trim 후 1자 이상, 상한 예: 2000자) |

**Response (200)**

```json
{
  "ok": true,
  "xp": 25,
  "feedback": {
    "praise": "한 줄 칭찬 문구",
    "suggestion": "한 줄 보완 제안 (선택)"
  }
}
```

**에러**

- `401`: 비로그인
- `400`: runId/scenarioId/responseText 누락 또는 유효성 실패
- `404`: run 없음 또는 본인 run 아님
- `409`: 해당 run에서 이미 FREE_RESPONSE 이벤트 존재 (중복 제출 방지)

---

## 3. XP 규칙 (MVP)

- **고정 XP**: 자유 입력 1회당 **25 XP** (시나리오 1회 25–40 범위와 유사).
- 추후: 길이·품질에 따라 15 / 25 / 35 등 구간 부여 가능 (LLM 또는 휴리스틱).

---

## 4. 피드백 (MVP)

- **규칙 기반**: 응답 텍스트 길이·유효성만 보고 고정 문구 반환.
  - 예: `praise`: "You took time to put your response in your own words."
  - 예: `suggestion`: "Next time, try linking your idea to the scenario context."
- 추후: LLM으로 시나리오 + 사용자 입력 → 칭찬/보완 1문장씩 생성 가능.

---

## 5. 저장

- **arena_events** 에 1건 insert:
  - `event_type`: `"FREE_RESPONSE"`
  - `step`: `2`
  - `scenario_id`, `run_id`, `user_id`: 요청 값
  - `xp`: 반환한 XP (예: 25)
  - `meta`: `{ "responseText": "...", "praise": "...", "suggestion": "..." }`
- **increment_arena_xp** RPC 호출로 run의 total_xp 증가 (기존 event 플로우와 동일).
- run/complete 시 이 이벤트의 `xp`가 다른 이벤트와 함께 합산되어 weekly_xp·Core 전환에 포함됨.

---

## 6. UI

- **제출**: "기타" 입력 후 제출 버튼 클릭 시 `POST /api/arena/free-response` 호출.
- **성공 시**: Step 3으로 이동, **피드백(praise / suggestion)** 과 **획득 XP** 표시. (기존 시스템 메시지 대신 또는 함께 표시)
- **실패 시**: 에러 메시지 표시, Step 2 유지·재제출 가능.

---

## 7. 완료 기준

- [ ] `POST /api/arena/free-response` 구현 (검증, 이벤트 저장, XP 반영)
- [ ] Arena Step 2 "기타" 제출 시 해당 API 호출 및 Step 3에서 피드백·XP 표시
- [ ] run/complete 시 FREE_RESPONSE 이벤트 XP가 weekly_xp·리더보드에 반영됨
