# BTY QA Checklist — Arena → Reflection → History

> **용도:** 기획 문서가 아니라, **직접 눌러보면서** 3단계 루프가 살아 있는지 확인하는 실행 체크리스트.

---

## 1. Arena Play 진입

- [ ] `/en/bty-arena` 진입
- [ ] **Enter Arena** 버튼 보임
- [ ] 클릭 시 `/en/bty-arena/play` 이동
- [ ] 시나리오 제목 보임
- [ ] Primary decision 카드 3개 보임
- [ ] Reinforcement는 처음엔 숨김 또는 비활성

---

## 2. Arena Decision 선택

- [ ] Primary 하나 선택 가능
- [ ] 선택 후 다른 primary는 잠김/희미해짐
- [ ] Reinforcement 섹션 열림
- [ ] Reinforcement 하나 선택 가능
- [ ] **Resolve Decision** 버튼 활성화
- [ ] 클릭 시 `/en/bty-arena/result` 이동

---

## 3. Arena Result

- [ ] sealed decision 카드 보임
- [ ] interpretation 문장 보임
- [ ] **Review Reflection** 버튼 보임
- [ ] **Continue Arena** 버튼 보임
- [ ] **Return to Arena** 버튼 보임

---

## 4. Reflection Seed 생성 확인

Result 화면 도착 후 **DevTools**에서:

```js
localStorage.getItem("bty-growth-seeds");
```

- [ ] 값이 존재함
- [ ] latest seed에 아래가 있음: `scenarioId`, `primary`, `reinforcement`, `focus`, `promptTitle`, `promptBody`, `cue`

---

## 5. Review Reflection 진입

- [ ] **Review Reflection** 클릭
- [ ] `/en/growth/reflection` 이동
- [ ] prompt title 보임
- [ ] prompt body 보임
- [ ] cue 보임
- [ ] 질문 3개 + commitment 입력칸 보임

---

## 6. Reflection Writing 저장

- [ ] answer1 입력 가능
- [ ] answer2 입력 가능
- [ ] answer3 입력 가능
- [ ] commitment 입력 가능
- [ ] 입력 전 Save 버튼 비활성 또는 저장 불가
- [ ] 4개 모두 입력 후 Save 가능
- [ ] Save 클릭 시 `/en/growth/history` 이동

---

## 7. ReflectionEntry 저장 확인

History 화면 도착 후 **DevTools**에서:

```js
localStorage.getItem("bty-reflections");
```

- [ ] 값이 존재함
- [ ] latest reflection에 아래가 있음: `scenarioId`, `focus`, `promptTitle`, `answer1`, `answer2`, `answer3`, `commitment`, `createdAt`

---

## 8. Growth History 표시

- [ ] `/en/growth/history` 진입
- [ ] history list 보임
- [ ] 최소 1개 reflection card 보임
- [ ] 카드에 **focus** 보임
- [ ] 카드에 **promptTitle** 보임
- [ ] 카드에 **commitment** 보임
- [ ] 날짜 또는 createdAt 표시 보임

---

## 9. 기본 빈 상태도 확인

브라우저 storage 비운 뒤:

```js
localStorage.removeItem("bty-growth-seeds");
localStorage.removeItem("bty-reflections");
sessionStorage.removeItem("bty-arena-session");
```

- [ ] `/en/growth/reflection` 진입 시 빈 상태 문구 보임
- [ ] `/en/growth/history` 진입 시 empty state 보임
- [ ] 앱이 깨지지 않음

---

## 최소 성공 기준 (4개)

1. Arena Result에서 **seed 생성**
2. Reflection Writing에서 **entry 저장**
3. History에서 **방금 저장한 카드 보임**
4. **빈 상태**에서도 에러 없이 동작

---

## 실패 시 원인 좁히는 순서

| 증상 | 의심 |
|------|------|
| Result에서 Reflection 안 넘어감 | route 문제 또는 button handler 문제 |
| Reflection 화면이 비어 있음 | `bty-growth-seeds` 저장 실패 또는 latest seed load 문제 |
| Save 후 History에 안 보임 | `bty-reflections` 저장 실패 또는 history load 문제 |
| History는 뜨는데 내용 없음 | mapping 필드 이름 불일치 (`promptTitle` vs `prompt_title`, `createdAt` vs `created_at`) |

---

## 한 줄 결론

**“Arena 결과가 Reflection으로 넘어가고, 쓴 내용이 History에 남는가”** — 이 한 줄만 확인하면 됩니다.

---

*E2E 최소본: `e2e/bty/growth-flow.spec.ts`, `e2e/bty/full-loop.spec.ts`*
