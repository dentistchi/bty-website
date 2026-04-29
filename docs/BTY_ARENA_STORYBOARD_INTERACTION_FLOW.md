# BTY Arena — Storyboard & Interaction Flow

**목적**: 화면 전환·애니메이션 원칙과 전환 매트릭스를 정리해, 디자인·구현 시 일관된 스토리보드/인터랙션 플로우를 쓰기 위함.  
**관련**: `BTY_ARENA_VISUAL_TOC.md` (화면 목록·딥링크), `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` (블록·컴포넌트)

---

## 1. 화면 애니/전환에 대한 의견

- **도입 추천**: 화면별 **진입/이탈 애니메이션**과 **전환 방식**을 한 번 정의해 두면, Figma 스토리보드·프로토타입·개발 모두에서 동일한 규칙을 쓰기 좋습니다.
- **FFT(Flow/전환) 수준**:  
  - **과하지 않게**: 전 화면을 복잡한 애니로 만들기보다, **페이지 전환**은 1~2가지 패턴(예: fade, slide-left/right)으로 통일하고, **인라인 피드백**(버튼 클릭·칩 추가·슬라이더 등)만 짧은 애니(100–200ms)로 두는 편이 유지보수와 접근성에 유리합니다.  
  - **접근성**: `prefers-reduced-motion: reduce` 시 전환 시간을 0 또는 매우 짧게 두는 것을 권장합니다.
- **다이어그램**: 아래 §4 전환 매트릭스 + §5 플로우 다이어그램만 있어도, “어디서 어디로, 어떤 느낌으로 넘어가는지”를 스토리보드·이슈에서 공유하기 충분합니다.  
  Figma 프로토타입 링크와 문서 앵커(`#arena-home` 등)를 함께 쓰면 “화면 ↔ 문서 ↔ 디자인” 매핑이 명확해집니다.

---

## 2. 전환 타입 & Duration (Motion Spec)

**Screen to Screen**

| 전환 | Duration |
|------|----------|
| Fade In / Fade Out | 200ms |
| Slide Left / Slide Right | 300ms |
| Modal Open | 150ms (scale/opacity) |
| Modal Close | 150ms (scale/opacity) |

**Component Micro-Interaction**

| 상호작용 | Duration |
|----------|----------|
| Button Press | 80ms scale feedback |
| Progress Ring Fill | 400ms ease-out |

---

## 3. prefers-reduced-motion 처리

모든 애니메이션은 OS 수준 설정을 존중해야 합니다.

- **일반 사용자 플로우 애니메이션**: `prefers-reduced-motion: reduce`가 활성화되면 **비활성화**하고, 단순 **opacity 변경** 등으로 대체합니다.
- **필수 피드백**(예: 에러 시 shake): 유지 가능하되 **짧고 최소한**으로 제한합니다.

**CSS 예시**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

구현 시: 표준 플로우 전환은 위처럼 비활성화하고, 필수 피드백만 최소한의 동작으로 유지합니다.

---

## 4. 화면 전환 매트릭스

| From → To | 전환 타입 | 비고 |
|-----------|-----------|------|
| Arena Home → Arena Simulation | slide-left | 시뮬레이션 시작 |
| Arena Simulation → Arena Result | fade 또는 slide-left | 선택 완료 |
| Arena Result → Foundry Home | slide-left | Review in Foundry |
| Arena Result → Arena Home | slide-right (또는 fade) | Back to Arena |
| Arena Home → Team Board | slide-left | Team Board Open |
| Team Board → Arena Home | slide-right | Back |
| Foundry Home → Decision Replay / Stats / Trend / Insights | slide-left | 상세 진입 |
| Foundry * → Foundry Home | slide-right | Back to Foundry |
| Foundry Home, Insight Cards → Center Entry | fade 또는 slide-left | Suggest Center |
| Center Entry → Safe Mirror / Small Wins | slide-left | |
| Safe Mirror / Small Wins / Self-esteem → Center Mini Recovery | fade | 제출 후 |
| Center Mini Recovery → Arena Home | slide-right 또는 fade | Back to Arena |
| (공통) → Mentor Chat Panel | slide from right (패널) | 챗봇 열기 |
| (공통) → Settings / Profile | slide-left | |

---

## 5. Interaction Flow 다이어그램 (전환 라벨)

아래는 `BTY_ARENA_VISUAL_TOC.md`의 SCREENFLOW DIAGRAM에 **전환 방식**을 붙인 버전입니다. 스토리보드·Figma 프로토타입에서 “이 링크는 slide-left 250ms”처럼 지정할 때 참고하세요.

```
[Arena Home] ──slide-left──► [Arena Simulation] ──fade──► [Arena Result]
     │                              │                              │
     │ slide-left                   │                              ├── slide-left ──► [Foundry Home]
     ▼                              │                              └── slide-right ──► [Arena Home]
[Team Board]                        │                                        │
     │ slide-right                   │                    ┌───────────────────┼───────────────────┐
     │                              │                    ▼                   ▼                   ▼
     │                    [Decision Replay]    [Hidden Stats]      [Trend Graph]    [Insight Cards]
     │                              │ slide-right (각 → Foundry Home)
     │                              └────────────────────┴───────────────────┴── fade/slide-left ──► [Center Entry]
     │                                                                                   │
     │                                                                     ┌─────────────┴─────────────┐
     │                                                                     ▼                           ▼
     │                                                           [Safe Mirror]              [Small Wins Capture]
     │                                                                     │ fade                         │ fade
     │                                                                     └───────────┬───────────────┘
     │                                                                                 │
     │                                                                     [Self-esteem Check]
     │                                                                                 │ fade
     │                                                                                 ▼
     │                                                                     [Center Mini Recovery] ──slide-right/fade──► [Arena Home]
     │
     └──────────────────────────────────────────────────────────────────── [Mentor Chat Panel] (slide from right)
     └──────────────────────────────────────────────────────────────────── [Settings / Profile] (slide-left)
```

---

## 6. 다음 단계

- [ ] Figma에서 15화면 프레임에 전환 링크 부여 시, 위 테이블의 “전환 타입”을 프로토타입 옵션으로 적용.
- [ ] 구현 시 Next.js App Router 기준: `view-transitions` 또는 라우트별 `key` + CSS transition로 위 규칙 적용.
- [ ] `prefers-reduced-motion` 대응: 전역 스타일에서 `@media (prefers-reduced-motion: reduce)` 시 transition-duration 0 또는 50ms 이하로 오버라이드.

---

## Notes

- **Motion spec은 Component spec과 독립**입니다. 컴포넌트 구조가 바뀌어도 전환 타입·Duration은 이 문서를 기준으로 유지할 수 있습니다.
- **Accessibility-first**: 시각 피드백과 비시각 피드백(포커스, 스크린리더, 상태 텍스트)을 **동시에** 제공합니다.

---

**문서 위치**: `bty-app/docs/BTY_ARENA_STORYBOARD_INTERACTION_FLOW.md`  
**참조**: `BTY_ARENA_VISUAL_TOC.md` (화면·SCREENFLOW), `BTY_ARENA_DESIGN_TOKENS.md` (일관된 타이밍·easing)
