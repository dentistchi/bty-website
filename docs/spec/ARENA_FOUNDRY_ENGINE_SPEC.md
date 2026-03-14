# Arena–Foundry Engine Spec (10-Part)

> 단일 참조: 콘텐츠·분류·시나리오·행동·지연결과·관점전환·메모리·AIR·리퍼테이션·시스템 흐름·구현 체크리스트.  
> **갱신:** 2026-03-09.  
> **연계 문서:** `LEADER_FOUNDRY_ARCHITECTURE.md`, `FOUNDRY_MVP_10_PROGRAMS.md`, `BTY_ARENA_DOMAIN_SPEC.md`, `FOUNDRY_DOMAIN_SPEC.md`, `MVP_AND_COMPLETION_INDICATORS.md`, `PROGRESS_TRACKER.md`.

---

## Part 1. Content & Classification

| 항목 | 내용 |
|------|------|
| **퍼널** | 50 → 8 → 30 → 12 (50 시나리오 → 8 Archetype → 30 Core → 12 Foundry) |
| **8 Archetype** | 정의·신호·핵심 질문 |
| **분류 원칙** | 리더 패턴 우선 분류 |
| **추출 필드** | 9개 |
| **점수·Primary/Secondary** | 시나리오별 Primary/Secondary archetype, 타이브레이크 |
| **30 Core 분포** | 30개 Core Arena 선정 및 분포 |
| **8×12 Foundry 매핑** | 8 Archetype × 12 Foundry 프로그램 매핑 테이블 |

**구현 체크:** `MVP_AND_COMPLETION_INDICATORS.md` A1~A4, `PROGRESS_TRACKER.md` D3·D4·D5.

---

## Part 2. Scenario Engine

| 항목 | 내용 |
|------|------|
| **ID 체계** | Base / POV 시나리오 ID (같은 base, 다른 POV) |
| **Arena Engine Format** | YAML 스키마: Trigger, Choice, Immediate/Delayed Outcome, Hidden Emotion, Mirror, Foundry, choice별 `behavior_flags` |
| **검수** | 시나리오 검수 체크리스트 |

**구현 체크:** `docs/specs/scenarios/` SCN_*.json 50건, `bty_scenario_v1` 스키마, `hidden_delta`·`result`·`micro_insight`·`follow_up`·`coach_notes`. `behavior_flags` per choice는 스펙 확장 대상.

---

## Part 3. Behavior Engine

| 항목 | 내용 |
|------|------|
| **플래그** | 6개 플래그 정의 |
| **매핑** | 선택(Choice) → 플래그 매핑 규칙 |

**구현 체크:** `reflection-engine`(when_blame, when_defensive 등), `hidden_delta`(integrity, communication 등). 6플래그·choice→플래그 규칙은 도메인 상수·매핑 테이블로 확정 필요.

---

## Part 4. Delayed Outcome Engine

| 항목 | 내용 |
|------|------|
| **슬라이딩 윈도우** | 예: 6 |
| **임계값** | 예: 2 |
| **트리거** | 1~3 시나리오 후 트리거 |
| **플래그별 결과 서사** | 플래그별 지연 결과 narrative |
| **차원** | 4가지 차원 |
| **단기 세션** | early-signal 경로 |

**구현 체크:** `MVP_AND_COMPLETION_INDICATORS.md` E3. 시나리오 스키마에 `delayed_outcome` 필드 존재. 슬라이딩 윈도우·임계값·주입 로직은 미구현.

---

## Part 5. Perspective Switch

| 항목 | 내용 |
|------|------|
| **Within** | 선택 후 Hidden Perspectives 노출 |
| **Cross** | 같은 base 다른 POV 재생(리플레이) |
| **조건·프레이밍** | 재생 조건·프레이밍 |
| **관점 전용** | Mirror·Foundry 관점 전용 콘텐츠 |

**구현 체크:** `MVP_AND_COMPLETION_INDICATORS.md` E4·E5. Base/POV ID 체계·리플레이 UI 미구현.

---

## Part 6. Memory Engine

| 항목 | 내용 |
|------|------|
| **저장 스키마** | 결정·플래그 이력·결과·관점 |
| **패턴 감지** | 이력 기반 패턴 감지 |
| **"Last time you…"** | 동일 archetype/플래그일 때만 노출 |
| **연동** | Delayed Outcome·Mirror 연동 |

**구현 체크:** `MVP_AND_COMPLETION_INDICATORS.md` E6·E7, `PROGRESS_TRACKER.md` A6. run/complete·이력 조회 있음. 결정·플래그 이력·패턴·"Last time you…" 스키마·로직 미구현.

---

## Part 7. AIR

| 항목 | 내용 |
|------|------|
| **정의** | A/I/R 정의 (Action–Integrity–Rating 또는 동일 계열) |
| **플래그→AIR** | 플래그에 따른 AIR 증감 |
| **점진·패턴** | 점진 반영·패턴 반영 |
| **노출** | 숫자보다 서사/밴드 노출 |

**구현 체크:** `src/domain/leadership-engine/air.ts`, `computeWeightedAIR`, `/api/arena/leadership-engine/air`. AIR 정의·플래그 연동·밴드/서사 노출은 스펙과 대조 후 정합성 점검.

---

## Part 8. Reputation Engine

| 항목 | 내용 |
|------|------|
| **개인 AIR** | 비공개 |
| **Team Index** | 공식(가중치 예: 40/30/20/10) |
| **가시성** | 가시성 규칙 |
| **Certified Leader** | 90일 갱신·미충족 시 해제 |
| **마일스톤·리더보드** | 밴드, 30일/90일 주기 |

**구현 체크:** `certified.ts`, `tii.ts`, `lri.ts`, `/api/arena/leadership-engine/certified`, `/api/arena/leadership-engine/tii`. Team Index 공식·가시성·Certified 90일 갱신·해제는 스펙 반영 여부 확인.

---

## Part 9. System Flow

| 항목 | 내용 |
|------|------|
| **한 번의 플레이** | 시나리오 → 선택 → Behavior → Memory → Delayed Outcome·Mirror·Perspective → AIR·Reputation |
| **데이터 흐름** | 데이터 흐름 개요 |

**구현 체크:** `LEADER_FOUNDRY_ARCHITECTURE.md` §5 Arena→Foundry→Arena 루프. 현재: 시나리오→선택→즉시 결과·XP·리플렉션·run/complete 저장까지 구현. Delayed Outcome·Memory·"Last time you…"·Perspective 리플레이·Reputation 가시성은 미연결 또는 부분.

---

## Part 10. Implementation Checklist

콘텐츠·엔진별 구현 체크리스트는 아래 표와 `MVP_AND_COMPLETION_INDICATORS.md` §5·§6·§7, `PROGRESS_TRACKER.md` §1·§2와 동기화한다.

### 10.1 콘텐츠·분류

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1.1 | 50→8→30→12 퍼널 정의 | [ ] | 문서화 |
| 1.2 | 8 Archetype 정의·신호·핵심 질문 | [ ] | LEADER_FOUNDRY_ARCHITECTURE 10 카테고리와 매핑 검토 |
| 1.3 | 추출 필드 9개 확정 | [ ] | 시나리오 스키마 필드와 일치 |
| 1.4 | 30 Core 선정·분포 | [ ] | 50 중 30 Core Arena Engine Format 적용 |
| 1.5 | 8×12 Foundry 매핑 테이블 | [x] | D5 완료·LEADER_FOUNDRY_ARCHITECTURE 매핑 표 |

### 10.2 Scenario Engine

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 2.1 | Base/POV 시나리오 ID 체계 | [ ] | SCN_*_NNNN 확장 또는 POV 접미사 |
| 2.2 | Arena Engine Format YAML 스키마 | [ ] | Trigger, Choice, Immediate/Delayed Outcome, Hidden Emotion, Mirror, Foundry, behavior_flags |
| 2.3 | 검수 체크리스트 | [ ] | 시나리오별 검수 항목 |

### 10.3 Behavior Engine

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 3.1 | 6개 플래그 정의 | [ ] | 도메인 상수 |
| 3.2 | Choice → 플래그 매핑 규칙 | [ ] | 시나리오/choice별 매핑 |

### 10.4 Delayed Outcome Engine

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 4.1 | 슬라이딩 윈도우·임계값 (예: 6, 2) | [ ] | 도메인/서비스 |
| 4.2 | 1~3 시나리오 후 트리거 로직 | [ ] | |
| 4.3 | 플래그별 결과 서사·4차원 | [ ] | |
| 4.4 | 단기 세션 early-signal 경로 | [ ] | |

### 10.5 Perspective Switch

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 5.1 | Within: 선택 후 Hidden Perspectives | [ ] | UI·데이터 |
| 5.2 | Cross: 같은 base 다른 POV 재생 | [ ] | ID 체계·API·UI |
| 5.3 | 관점 전용 Mirror·Foundry | [ ] | |

### 10.6 Memory Engine

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 6.1 | 저장 스키마 (결정·플래그 이력·결과·관점) | [ ] | DB/저장소 |
| 6.2 | 패턴 감지 | [ ] | |
| 6.3 | "Last time you…" 노출 규칙 (동일 archetype/플래그) | [ ] | |
| 6.4 | Delayed Outcome·Mirror 연동 | [ ] | |

### 10.7 AIR

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 7.1 | A/I/R 정의·플래그→AIR 증감 | [ ] | air.ts·스펙 정합 |
| 7.2 | 점진·패턴 반영 | [ ] | |
| 7.3 | 서사/밴드 노출 (숫자 최소화) | [ ] | UI |

### 10.8 Reputation Engine

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 8.1 | 개인 AIR 비공개·Team Index 공식 | [ ] | |
| 8.2 | 가시성 규칙 | [ ] | |
| 8.3 | Certified Leader 90일 갱신·해제 | [ ] | certified·정책 |
| 8.4 | 마일스톤·리더보드 밴드·30일/90일 | [ ] | |

### 10.9 System Flow

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 9.1 | 한 번의 플레이 흐름 문서·다이어그램 | [ ] | Part 9 내용 |
| 9.2 | 데이터 흐름 개요 | [ ] | |

---

## 문서 매핑

| Part | 참조 문서 |
|------|-----------|
| 1 | MVP_AND_COMPLETION_INDICATORS.md, PROGRESS_TRACKER.md, LEADER_FOUNDRY_ARCHITECTURE.md |
| 2 | BTY_ARENA_DOMAIN_SPEC.md, docs/specs/scenarios/, FOUNDRY_DOMAIN_SPEC.md §5 |
| 3 | reflection-engine, arena/engine, hidden_delta |
| 4 | MVP_AND_COMPLETION_INDICATORS.md E3 |
| 5 | MVP_AND_COMPLETION_INDICATORS.md E4·E5 |
| 6 | MVP_AND_COMPLETION_INDICATORS.md E6·E7, PROGRESS_TRACKER A6 |
| 7 | domain/leadership-engine/air.ts, AIR API |
| 8 | domain/leadership-engine/certified.ts, tii.ts, lri.ts |
| 9 | LEADER_FOUNDRY_ARCHITECTURE.md §5 Arena→Foundry→Arena |
| 10 | 본 문서 §10, MVP_AND_COMPLETION_INDICATORS.md, PROGRESS_TRACKER.md |

---

*이 스펙은 Part 1~10 단일 기준으로, 콘텐츠·엔진·구현 체크리스트를 갱신할 때 사용한다.*
