# BTY 12 Core Axis — Decision Distortion Pattern System

**버전**: v1.1  
**목적**: BTY Arena 시나리오 설계, pattern_family 매핑, QR contract 연결, leaderboard 의미 부여의 공통 기반.  
**핵심 원칙**: 이 12개는 성격 테스트가 아니다. 압박 상황에서 반복되는 **왜곡된 선택 패턴**이다.

---

## 기존 8축 명세와의 관계 (v1 QR Trigger 명세 기준)

기존 QR Trigger v1 명세의 8축: `Ownership / Time / Conflict / Truth / Repair / Authority / Integrity / Courage`

| 기존 8축 | v1.1 처리 |
|---|---|
| Ownership | Axis 1 — 유지 |
| Time | Axis 2 — 유지 |
| Authority | Axis 3 — 유지 |
| Truth | Axis 4 — 유지 |
| Repair | Axis 5 — 유지 |
| Conflict | Axis 6 — 유지 |
| Integrity | Axis 7 — 유지 |
| **Courage** | **Axis 10 (Courage/Risk)로 흡수 + 명시적 유지** |
| *(신규)* | Axis 8 — Visibility |
| *(신규)* | Axis 9 — Accountability |
| *(신규)* | Axis 11 — Control |
| *(신규)* | Axis 12 — Identity (meta-axis) |

**Courage 처리 근거**: Courage = 위험을 인식하면서도 옳은 행동을 선택하는 것. Risk/Courage는 동일한 결정 순간의 두 면이다. `Axis 10 — Courage/Risk`로 명칭을 유지하면서 통합.

---

## Axis 12 — Identity의 특수 지위

**Identity는 독립 축이면서 동시에 모든 축의 meta-axis다.**

```
Axis 1~11: 개별 압박 상황의 왜곡 패턴
              ↓ 누적
Axis 12 (Identity): "이 사람은 압박 속에서 어떤 리더인가"
```

Action Decision 단계의 모든 선택은 암묵적으로 Axis 12를 통과한다.

---

## 12 Core Axes

### Axis 1 — Ownership (책임)
**핵심 질문**: 이 문제가 내 책임인가, 아닌가를 어떻게 정의하는가?
- **entry**: `ownership_claim` — 구조적 원인이 있어도 자신의 역할을 명확히 수용한다
- **exit**: `ownership_escape` — 구조 탓, 상황 탓으로 책임을 분산시킨다
- **시나리오**: 직원 실수 + 시스템 실패, write-up vs 구조 개선
- **연결**: Axis 9 (Accountability)

### Axis 2 — Time (시간)
**핵심 질문**: 지금 행동하는가, 나중으로 미루는가?
- **entry**: `present_action` — 불편하더라도 지금 결정하고 실행한다
- **exit**: `future_deferral` — "더 많은 정보가 생기면"으로 연기한다
- **시나리오**: 지금 개입하면 마찰이 생기는 상황
- **연결**: Axis 10 (Courage/Risk)

### Axis 3 — Authority (권위)
**핵심 질문**: 내 권한을 직접 행사하는가, 위임/핑계로 우회하는가?
- **entry**: `authority_exercise` — 권한 범위 안에서 직접 결정하고 책임진다
- **exit**: `delegation_deflection` — 위로 떠넘기거나, 결정을 타인에게 의존한다
- **시나리오**: 파트너 갈등, 상사 지시 vs 현장 판단
- **연결**: Axis 11 (Control)

### Axis 4 — Truth (진실)
**핵심 질문**: 사실을 직면하는가, 설명으로 포장하는가?
- **entry**: `truth_naming` — 불편한 진실을 명확하게 명명하고 기록한다
- **exit**: `explanation_substitution` — 사실 대신 해석, 맥락, 이유를 앞세운다
- **시나리오**: 성과 보고, exit interview, KPI 왜곡
- **연결**: Axis 8 (Visibility)

### Axis 5 — Repair (복구)
**핵심 질문**: 깨진 것을 고치려 하는가, 그냥 넘어가는가?
- **entry**: `repair_initiation` — 관계나 구조의 손상을 인식하고 복구 행동을 취한다
- **exit**: `repair_avoidance` — 불편한 대화를 피하고 자연 회복을 기다린다
- **시나리오**: 팀 갈등 후 후속 조치, 신뢰 손상 후 복구
- **연결**: Axis 6 (Conflict)

### Axis 6 — Conflict (갈등)
**핵심 질문**: 갈등을 직면하는가, 완화/회피하는가?
- **entry**: `conflict_engagement` — 갈등의 핵심을 명명하고 당사자와 직접 다룬다
- **exit**: `conflict_avoidance` — 분위기 관리, 우회, 제3자를 통한 간접 처리
- **시나리오**: 파트너 공개 반박, 매니저 보복 문화
- **연결**: Axis 5 (Repair)

### Axis 7 — Integrity (기준)
**핵심 질문**: 내 기준을 압박 속에서도 유지하는가, 상황에 타협하는가?
- **entry**: `integrity_hold` — 압박이 있어도 자신의 임상/윤리 기준을 고수한다
- **exit**: `integrity_compromise` — "이번만", "다들 이렇게 한다"로 기준을 낮춘다
- **시나리오**: upcoding 압박, 임상 자율성 침해, 보너스 vs 환자 안전
- **연결**: Axis 12 (Identity)

### Axis 8 — Visibility (가시성)
**핵심 질문**: 문제를 드러내는가, 숨기는가?
- **entry**: `visibility_disclosure` — 문제를 공개적으로 기록하고 적절한 사람에게 알린다
- **exit**: `visibility_suppression` — 로그 누락, 비공식 처리, "없었던 일"로 처리
- **시나리오**: 환자 불만 미기록, turnover 원인 은폐
- **연결**: Axis 4 (Truth)

### Axis 9 — Accountability (책임 귀속)
**핵심 질문**: 시스템 실패를 시스템으로 다루는가, 개인에게 전가하는가?
- **entry**: `accountability_system` — 개인 실수와 구조적 원인을 분리해서 둘 다 다룬다
- **exit**: `accountability_deflection` — 구조 문제를 개인 탓으로만 처리한다
- **시나리오**: write-up vs 시스템 개선, turnover 보고서
- **연결**: Axis 1 (Ownership)

### Axis 10 — Courage/Risk (용기/위험 감수)
**핵심 질문**: 옳은 선택에 따르는 위험을 감수하는가, 안전한 선택을 하는가?

> **기존 QR v1 명세의 Courage 축을 이 축으로 완전히 커버한다.**

- **entry**: `courage_act` — 개인적 불이익이 있더라도 옳다고 판단한 행동을 한다
- **exit**: `risk_aversion` — 보복, 평판 손상이 두려워 행동을 안 한다
- **시나리오**: whistleblower 상황, 상사 피드백, exit interview 진실
- **연결**: Axis 12 (Identity)

### Axis 11 — Control (통제)
**핵심 질문**: 통제할 수 없는 현실을 수용하는가, 통제 유지에 집착하는가?
- **entry**: `control_discernment` — 내가 바꿀 수 있는 것과 없는 것을 구분하고 행동한다
- **exit**: `control_fixation` — 통제 불가능한 것에 에너지를 쏟거나, 통제 가능한 것을 포기한다
- **시나리오**: DSO 정책 vs 현장 판단, 파트너 지분 갈등
- **연결**: Axis 3 (Authority)

### Axis 12 — Identity (정체성) ← META-AXIS
**핵심 질문**: 압박 속에서도 "나는 어떤 리더인가"를 지키는가, 무너지는가?

> **독립 축이면서 모든 축의 상위 레이어. Action Decision 단계의 모든 선택은 이 축을 통과한다.**

- **entry**: `identity_hold` — 상황이 어떻든 자신의 리더십 정체성에서 결정한다
- **exit**: `identity_drift` — 압박에 의해 자신답지 않은 결정을 하고 합리화한다
- **시나리오**: 모든 시나리오의 Action Decision 단계
- **연결**: 모든 축 (meta)

---

## pattern_family 전체 매핑 테이블

| pattern_family | 방향 | Core Axis | 구현 상태 |
|---|---|---|---|
| `ownership_claim` | entry | Axis 1 Ownership | ❌ |
| `ownership_escape` | exit | Axis 1 Ownership | ✅ |
| `present_action` | entry | Axis 2 Time | ❌ |
| `future_deferral` | exit | Axis 2 Time | ✅ |
| `authority_exercise` | entry | Axis 3 Authority | ❌ |
| `delegation_deflection` | exit | Axis 3 Authority | ✅ |
| `truth_naming` | entry | Axis 4 Truth | ❌ |
| `explanation_substitution` | exit | Axis 4 Truth | ✅ |
| `repair_initiation` | entry | Axis 5 Repair | ❌ |
| `repair_avoidance` | exit | Axis 5 Repair | ✅ |
| `conflict_engagement` | entry | Axis 6 Conflict | ❌ |
| `conflict_avoidance` | exit | Axis 6 Conflict | ❌ |
| `integrity_hold` | entry | Axis 7 Integrity | ❌ |
| `integrity_compromise` | exit | Axis 7 Integrity | ❌ |
| `visibility_disclosure` | entry | Axis 8 Visibility | ❌ |
| `visibility_suppression` | exit | Axis 8 Visibility | ❌ |
| `accountability_system` | entry | Axis 9 Accountability | ❌ |
| `accountability_deflection` | exit | Axis 9 Accountability | ❌ |
| `courage_act` | entry | Axis 10 Courage/Risk | ❌ |
| `risk_aversion` | exit | Axis 10 Courage/Risk | ❌ |
| `control_discernment` | entry | Axis 11 Control | ❌ |
| `control_fixation` | exit | Axis 11 Control | ❌ |
| `identity_hold` | entry | Axis 12 Identity | ❌ |
| `identity_drift` | exit | Axis 12 Identity | ❌ |

---

## 시나리오 설계 원칙

**Primary Choice (4개)**: 행동이어야 함. 각 선택이 다른 축의 패턴을 유발. 정답 없음.

**Escalation Text (1~3문장)**: 선택 결과가 이미 발생한 상태. 원본 pressure 반복 금지. Generic prefix 금지. Branch A/B/C/D가 의미있게 달라야 함.

**Second Choices (X/Y)**:
- X: 리스크를 통제하되 문제를 살려두는 선택
- Y: 단기 마찰을 감수하고 직면하는 선택
- 둘 다 손해. Y가 정답처럼 보이면 안 됨.

**Action Decision**:
- `is_action_commitment: true`: 구체적 외부 행동 (시간/채널 명시)
- `is_action_commitment: false`: 추가 준비, 관찰, 대기
- 항상 Axis 12 (Identity)를 암묵적으로 포함

---

## 시나리오-축 할당 가이드

| 시나리오 유형 | 주 축 | 보조 축 |
|---|---|---|
| 직원 실수 + 시스템 실패 | Axis 1 Ownership | Axis 9 Accountability |
| 일정/볼륨 압박 | Axis 2 Time | Axis 7 Integrity |
| 파트너/권위 갈등 | Axis 3 Authority | Axis 6 Conflict |
| 보고/기록 왜곡 | Axis 4 Truth | Axis 8 Visibility |
| 팀 갈등 후속 | Axis 5 Repair | Axis 12 Identity |
| 내부 고발/위험 | Axis 10 Courage/Risk | Axis 12 Identity |
| DSO 정책 충돌 | Axis 11 Control | Axis 7 Integrity |

---

## 이 문서 사용법

- **새 채팅 시작 시**: 이 문서를 AI에게 먼저 읽히고 시작
- **시나리오 작성 시**: 주 축 + 보조 축 먼저 정하고 선택지 설계
- **Cursor rules**: `.cursor/rules/bty-core.mdc`에 12 Core Axis 요약 추가 필요
- **Re-exposure 검증**: entry_pattern_family로 성장 방향 확인
- **Gemma 지시문**: "Axis 1 (Ownership) 기반으로 escalation_text 작성" 형태로 구체화
