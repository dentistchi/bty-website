# BTY Training Center — MVP 단계 및 완성률 지표

**목적:** 1단계(MVP) 배포 범위 결정, Arena / Center / Foundry / 전체 완성률 정의.  
**전제:** 완성된 프로젝트 = 100%. MVP는 그중 일정 비율까지 구현 후 배포.

---

## 1. 프로젝트 영역 정의 (Arena / Center / Foundry)

| 영역 | 정의 | 핵심 산출물 |
|------|------|-------------|
| **Arena** | 리더십 시뮬레이션. 시나리오 플레이 → 행동 플래그 → 지연 결과 → 관점 전환 → 메모리·AIR·리퍼테이션. | Scenario Engine, Behavior Engine, Delayed Outcome, Perspective Switch, Memory, AIR, Reputation |
| **Center** | 훈련 허브. 대시보드, 진도·추천, 팀/개인 요약, 진입점. | 대시보드, 나의 진도, 팀 요약, Arena/Foundry 진입, (선택) Action QR |
| **Foundry** | 리더 철학 교육. 12개 프로그램. Arena 결과에 따라 추천·언락. | 12 Foundry Lessons, Arena→Foundry 연결, 수강·완료 추적 |

---

## 2. 단계(Phase) 정의

| 단계 | 목표 | 배포 |
|------|------|------|
| **Phase 1 — MVP** | 최소 유효 제품. 사용자가 Arena 시나리오를 플레이하고, 선택에 따른 즉각 결과·미러를 보고, (선택) Foundry 추천을 받을 수 있는 상태. | ✅ 배포 |
| **Phase 2 — 행동 엔진** | Delayed Outcome, Memory, AIR까지 연결. “Last time you…”·패턴 피드백. | 배포 |
| **Phase 3 — 관점·리퍼테이션** | Perspective Switch(재생), Reputation(Team Index, 인증), 완전한 12 Foundry. | 배포 |
| **Phase 4 — 완성** | 30 Core × POV, Action QR, 모든 엔진·콘텐츠·운영 기능. | 100% 기준 |

---

## 3. 완성률 지표 — 설계 원칙

- **전체 완성률** = 가중 평균 (Arena 비중 + Center 비중 + Foundry 비중).
- **영역별 완성률** = 해당 영역 내 **체크리스트 항목** 중 완료 비율 (0~100%).
- **MVP 완성도** = “MVP 범위 안의 항목만”으로 계산한 완성률.  
  → MVP 범위를 100%로 두고, “현재 MVP 완성률 = MVP 항목 중 완료 %”로도 사용 가능.

---

## 4. 영역별 가중치 (전체 100% 기준)

전체 완성률 계산 시 제안 가중치:

| 영역 | 가중치 | 이유 |
|------|--------|------|
| Arena | 50% | 핵심 학습 경험 |
| Center | 25% | 진입·진도·요약 |
| Foundry | 25% | 철학 교육·Arena 연동 |

→ **전체 완성률 = Arena완성률×0.5 + Center완성률×0.25 + Foundry완성률×0.25**

---

## 5. Arena 완성률 (0~100%)

각 항목은 “구현·배포 완료” 시 1점. 부분 완료는 0.5 등으로 세분 가능.

### 5.1 콘텐츠 (Arena 내 25%)

| # | 항목 | MVP | Phase 2 | Phase 3 | Phase 4 |
|---|------|-----|---------|--------|--------|
| A1 | 50개 시나리오 1차 분류(primary/secondary) | — | — | — | ✓ |
| A2 | 30 Core Arena 선정 및 Arena Engine Format 문서화 | ✓ (최소 10개) | 30개 | 30개 | 30개 |
| A3 | 시나리오당 choice → behavior_flags 매핑 정의 | ✓ | ✓ | ✓ | ✓ |
| A4 | 8개 Archetype × 12 Foundry 매핑 테이블 | ✓ | ✓ | ✓ | ✓ |
| A5 | POV별 시나리오 (같은 base, 4 POV) | — | — | ✓ (일부) | ✓ (30 base×4) |

**Arena 콘텐츠 완성률** = (완료 항목 점수 합 / 해당 Phase 최대 점수) × 100.  
(예: MVP는 A2 최소 10개, A3, A4 완료 시 콘텐츠 100%.)

### 5.2 엔진 (Arena 내 75%)

| # | 항목 | MVP | Phase 2 | Phase 3 | Phase 4 |
|---|------|-----|---------|--------|--------|
| E1 | Scenario Engine: 시나리오 로드, Trigger/Choice/Immediate Outcome 표시 | ✓ | ✓ | ✓ | ✓ |
| E2 | Behavior Engine: 선택 시 플래그 기록, 저장 | ✓ | ✓ | ✓ | ✓ |
| E3 | Delayed Outcome Engine: 슬라이딩 윈도우, 임계값, 지연 시나리오 주입 | — | ✓ | ✓ | ✓ |
| E4 | Perspective Switch: 선택 후 Hidden Perspectives 노출 | ✓ (선택) | ✓ | ✓ | ✓ |
| E5 | Perspective Switch: 같은 base 다른 POV 재생(리플레이) | — | — | ✓ | ✓ |
| E6 | Memory Engine: 결정·플래그 이력 저장, 패턴 감지 | — | ✓ | ✓ | ✓ |
| E7 | Memory Engine: “Last time you…” 리콜(동일 archetype/flag 시) | — | ✓ | ✓ | ✓ |
| E8 | AIR: 플래그→AIR 계산, 점진 반영 | — | ✓ | ✓ | ✓ |
| E9 | Reputation: Team Index, 가시성 규칙, Certification(90일) | — | — | ✓ | ✓ |
| E10 | Mirror Question 표시, Foundry 추천 연결 | ✓ | ✓ | ✓ | ✓ |

**Arena 엔진 완성률** = (해당 Phase에서 완료한 E 항목 수 / 해당 Phase E 항목 수) × 100.

**Arena 전체 완성률** = 콘텐츠 25% + 엔진 75% (각각 위 체크리스트로 0~100% 산출 후 가중 평균).

---

## 6. Center 완성률 (0~100%)

| # | 항목 | MVP | Phase 2 | Phase 3 | Phase 4 |
|---|------|-----|---------|--------|--------|
| C1 | 로그인/세션(또는 최소 사용자 식별) | ✓ | ✓ | ✓ | ✓ |
| C2 | Arena 진입: 시나리오 목록 또는 다음 시나리오 진입 | ✓ | ✓ | ✓ | ✓ |
| C3 | 나의 진도: 완료 시나리오 수, (선택) 간단 요약 | ✓ | ✓ | ✓ | ✓ |
| C4 | Foundry 진입: 추천/언락된 프로그램 목록 | ✓ | ✓ | ✓ | ✓ |
| C5 | 팀 요약: Team Index·밴드·마일스톤 (비공개 개인 상세) | — | — | ✓ | ✓ |
| C6 | 대시보드: Arena/Foundry/Center 통합 뷰 | ✓ (최소) | ✓ | ✓ | ✓ |
| C7 | Action QR: 시나리오/Foundry 후 제안 액션 | — | — | — | ✓ |

**Center 완성률** = (해당 Phase에서 완료한 C 항목 수 / 해당 Phase C 항목 수) × 100.

---

## 7. Foundry 완성률 (0~100%)

| # | 항목 | MVP | Phase 2 | Phase 3 | Phase 4 |
|---|------|-----|---------|--------|--------|
| F1 | 12개 Foundry 프로그램 목록·메타데이터 | ✓ | ✓ | ✓ | ✓ |
| F2 | Arena 시나리오 완료 후 Foundry 추천(1~2개) 표시 | ✓ | ✓ | ✓ | ✓ |
| F3 | 수강/완료 상태 저장 및 표시 | ✓ | ✓ | ✓ | ✓ |
| F4 | 12개 프로그램 콘텐츠(핵심 메시지·구조) 완비 | ✓ (최소 3개) | 6개 | 12개 | 12개 |
| F5 | Archetype/플래그 기반 Foundry 자동 추천 로직 | ✓ | ✓ | ✓ | ✓ |

**Foundry 완성률** = (항목 완료 + F4는 개수 비율) 반영하여 0~100%.  
(예: F4가 3/12면 25%, 12/12면 100%.)

---

## 8. MVP 범위 요약 (Phase 1)

**MVP에 포함되는 것:**

- **Arena:**  
  - 시나리오 최소 10개(Arena Engine Format), Trigger/Choice/Immediate Outcome, Behavior 플래그 기록, Mirror + Foundry 추천.  
  - (선택) 선택 후 Hidden Perspectives.
- **Center:**  
  - 사용자 식별, Arena/Foundry 진입, 나의 진도(완료 수), 최소 대시보드.
- **Foundry:**  
  - 12개 목록·메타, Arena 완료 후 1~2개 추천, 수강/완료 추적, 최소 3개 프로그램 콘텐츠.

**MVP에 포함되지 않는 것:**

- Delayed Outcome Engine, Memory Engine, “Last time you…”, AIR, Reputation(Team Index, Certification).
- Perspective Switch 리플레이(같은 base 다른 POV).
- 30 Core 전부, POV×4 전부, Action QR.
- 팀 요약(Team Index 등).

---

## 9. 완성률 수식 정리

| 지표 | 계산 |
|------|------|
| **Arena 완성률** | (Arena 콘텐츠 완성률 × 0.25) + (Arena 엔진 완성률 × 0.75) |
| **Center 완성률** | (완료한 C 항목 수 / 해당 Phase C 항목 수) × 100 |
| **Foundry 완성률** | (F1~F3,F5 완료 + F4 개수 비율) → 0~100% |
| **전체 완성률** | Arena완성률×0.5 + Center완성률×0.25 + Foundry완성률×0.25 |
| **MVP 완성률** | Phase 1 체크리스트만으로 계산한 전체 완성률 (MVP 범위 = 100%일 때 현재 %). |
| **전체 대비 %** | 같은 완성률 공식으로, Phase 4 기준 최대 항목 대비 현재 완료 비율. |

---

## 10. 사용 예시

- **“지금 MVP 완성률이 얼마냐?”**  
  → Phase 1 Arena/Center/Foundry 체크리스트만 채우고, 위 수식으로 Arena/Center/Foundry/전체 % 산출.  
  → 예: Arena 60%, Center 80%, Foundry 50% → 전체 = 60×0.5 + 80×0.25 + 50×0.25 = 62.5%.
- **“MVP 배포 가능한가?”**  
  → MVP 완성률 ≥ 목표(예: 85%)이고, 필수 항목(시나리오 플레이, 플래그 기록, Mirror, Foundry 추천, 진입·진도) 모두 완료 시 배포 가능으로 정의.
- **“완성 프로젝트 대비 지금 몇 %냐?”**  
  → Phase 4 전체 체크리스트 기준으로 같은 공식 적용.  
  → 예: Phase 1만 완료면 전체의 약 25~35% 수준으로 설정 가능(Phase 4 항목 수 대비).

---

## 11. 문서 유지

- Phase별로 실제 완료한 항목에 체크([x])하고, 완성률은 위 수식으로 재계산.
- 새 기능/영역이 생기면 체크리스트에 항목 추가 후 가중치 재검토.
- **항목별 점수·일일 진행률·다음 작업 결정**은 **docs/PROGRESS_TRACKER.md** 사용 (서류/코드/배포 3대 작업 + Center/Arena/Foundry·동영상·애니메이션 포함).
- **"진행률이 얼마야?"** → **docs/PROGRESS_SNAPSHOT.md** (Center/Arena/Foundry/전체 % 한눈에). **"다음에 뭘 해야 해?"** → **docs/ROADMAP_IMPLEMENTATION.md** (구현 순서).

---

*이 문서는 MVP 배포 결정과 Arena/Center/Foundry·전체 완성률 지표의 단일 기준으로 사용한다.*
