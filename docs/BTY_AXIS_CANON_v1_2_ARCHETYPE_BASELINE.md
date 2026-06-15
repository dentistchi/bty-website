# BTY_AXIS_CANON v1.2 — ARCHETYPE BASELINE CORRECTION

> Disclosure-class correction. Pairs with: v1.0 (meaning, LOCKED) · v1.1 ADDENDUM (disclosure, LIVE).
> This file = create-only. v1.0 / v1.1 byte-untouched.
> Role provenance: 측정 = Claude Code (read-only inventory). 검증/arbiter = dispatch chat.
> 의미 본문 = Commander 저작. scaffold = 구조만.

---

## §0  PROVENANCE

- 측정 출처: BTY_AVATAR_AXIS_RELATIONSHIP STEP 0 INVENTORY (read-only, dual-tree resolved).
- 정정 권한: arbiter 판정 (Q1/Q2 한정 적용) → Commander 승인 → 이 문서.
- 본 문서가 정정하는 것: **Archetype baseline 라벨 하나** (RESERVED → 측정된 실제 상태).
- 본 문서가 정정하지 않는 것: Avatar (D, 이미 정합) · R1 substrate-split (CLOSED 유지) · 12-Axis 의미 (v1.0).
- Time-scoped honesty: current implementation ≠ permanent definition. Canon ⊃ implementation.

---

## §1  CORRECTED LABEL (명시인용 형식)

### §1.1  Archetype Baseline Correction

**이전 기준선 (정정 대상, 인용):**
> "7 Archetypes ... = rules.ts RULE_REGISTRY scored, Layer3 RESERVED"
> "[12_axis ...] 7 axis alias-resident or unimplemented ... RESERVED"

**정정 (측정 기반):**

| 항목 | 측정값 | 증거 |
|------|--------|------|
| 상태 | **NOT RESERVED** | F4 |
| compute | **LIVE** (deterministic selectArchetype) | F3 — selector.ts:33-62, fingerprint.ts:53-78 |
| wiring | **wired** (MyPage identity assembly) | F4 — getMyPageIdentityState.ts:88 |
| transport | **HTTP-served** | F4 — api/bty/archetype/route.ts:16-75 |
| axis 관계 | **multi-axis (B)** | F2 — rules.ts:19-78 |
| 구성 | 7 entries / AxisCondition sets | F2 |
| 결정성 보증 | CI isolation guard (FORBID LLM import) | F4 — archetype-isolation-check.mjs:7 |

**측정되지 않은 것 (LIVE로 단정 금지 — Q1/Q2 한정):**

| 항목 | 상태 | 증거/사유 |
|------|------|-----------|
| persistence (naming-lock 테이블 적용) | **NOT PROVEN** | RISK-2 — migrations-hold/20260505…sql (migrations/ 아님) |
| pixel-render (user-visible UI) | **NOT PROVEN** | Q2 — F4 사슬은 route response 까지만; 컴포넌트 렌더 미인용 |

> ∴ canon 사용 라벨 = **"compute-LIVE + wired + HTTP-served"**. bare "LIVE" 사용 금지.

**Commander Meaning:**

Archetype은 오랫동안 BTY 구조 안에 존재했지만, 기준선에서는 RESERVED로 분류되어 있었다. 그 분류는 잘못된 정의 때문이 아니라, 실제 구현 상태가 충분히 측정되지 않았기 때문이다.

이번 정정은 새로운 기능을 추가하거나 의미를 재정의하는 작업이 아니다. 이미 존재하던 구현 상태를 측정 결과에 맞게 정직하게 기록하는 작업이다.

측정 결과에 따르면 Archetype은 규칙 기반으로 계산되며, 정해진 축 조건을 통해 결정되고, 사용자 상태 조립 과정에 연결되어 있으며, HTTP 응답 계층까지 도달한다. 따라서 Archetype을 RESERVED로 유지하는 것은 현재 구현 상태를 정확하게 설명하지 못한다.

그러나 이 정정은 Archetype의 모든 영역이 완전히 입증되었다는 선언도 아니다.

현재 입증된 것은:
- 축 조건을 기반으로 계산된다는 점
- 계산 결과가 시스템에 연결되어 있다는 점
- 해당 결과가 응답 계층까지 전달된다는 점

현재 입증되지 않은 것은:
- 명명 잠금(persistence)이 실제 운영 데이터에 적용되었는가
- 사용자가 화면에서 해당 결과를 직접 보게 되는가

BTY Canon은 구현을 과장하지 않는다. 입증된 것은 입증된 것으로 기록하고, 입증되지 않은 것은 입증되지 않은 것으로 남긴다.

따라서 Archetype의 기준선은 이제 RESERVED가 아니라 **"compute-LIVE + wired + HTTP-served"** 로 정정된다.

이 정정은 Archetype의 의미를 바꾸는 것이 아니라, Archetype의 현재 상태를 사실에 맞게 기록하는 것이다.

### §1.2  Per-Archetype Axis Binding (측정값, 라벨만)

> 출처 F2 rules.ts:19-78. 의미·서사 = Commander.

| Archetype | axes | 축수 | 증거 | shape |
|-----------|------|------|------|-------|
| CLEARANCHOR | truth / accountability / integrity | 3 | rules.ts:21-28 | B |
| IRONROOT | authority / control / courage | 3 | rules.ts:30-37 | B |
| TRUEBEARING | truth / identity / accountability | 3 | rules.ts:38-46 | B |
| STILLWATER | conflict / repair / integrity | 3 | rules.ts:68-77 | B |
| OPENHAND | visibility / identity | 2 | rules.ts:47-54 | B |
| QUIETFLAME | repair / truth | 2 | rules.ts:55-62 | B |
| NIGHTFORGE | courage | 1 | rules.ts:63-67 | **A (단일축 예외)** |

**Commander Meaning:**

Archetype은 단일 성격 유형을 분류하기 위해 존재하지 않는다.

BTY에서 Archetype은 특정 축 하나를 대표하는 배지가 아니라, 반복적으로 관찰되는 축 조합의 표현 계층이다.

이번 측정은 각 Archetype이 어떤 축 조건들로 구성되어 있는지를 보여준다. 이 표는 의미를 정의하기 위한 표가 아니라, 현재 구현이 어떤 구조를 사용하고 있는지를 기록하기 위한 표다.

중요한 점은 대부분의 Archetype이 하나의 축이 아니라 여러 축의 조합으로 구성된다는 사실이다. 이는 BTY가 리더를 단일 특성으로 설명하지 않는다는 원칙과 일치한다. 실제 리더십은 책임, 진실, 무결성, 복구, 갈등, 권위와 같은 여러 압박이 동시에 작동하는 환경에서 드러난다.

따라서 Archetype은 개별 축을 대체하지 않는다. 12 Core Axis는 여전히 행동 왜곡과 행동 전환을 설명하는 기본 구조이며, Archetype은 그 위에 형성되는 해석 계층이다.

NIGHTFORGE가 단일 축 예외로 측정된 사실 또한 의미를 부여하기 전에 먼저 기록되어야 한다. Canon의 역할은 먼저 사실을 고정하는 것이지, 의미를 서둘러 확장하는 것이 아니다.

이 표는 각 Archetype의 서사, 정체성, 상징, 문화적 의미를 정의하지 않는다. 그 작업은 별도의 Archetype Meaning Canon에서 수행된다. 본 문서에서는 측정된 축 결합 구조만을 기준선으로 기록한다.

### §1.3  Avatar (변경 없음 — 정합 확인만)

**기준선:** Avatar = **D** (separate cosmetic/unlock layer, no axis wiring). 정정 불필요.
증거: F5 (양방향 grep empty) · F6 (tier/CoreXp/theme keyed) · F7 (avatar_* columns, schema-declared, no axis col).
> 이 기준선은 이미 정합. 본 정정의 대상 아님 — 대비용 기록만.

---

## §2  DISPLAY-LAYER JOIN (F10 — fact 기록, 결정은 forward)

**Fact (측정값):**
- archetypeName → codeNameOverride → computeLeadershipState({codeNameOverride, coreXp}).
- 증거: F10 — getMyPageIdentityState.ts:89-95.
- 효과: 축파생 archetype 이름이 MyPage leadership display 의 **progression Code 이름 slot 을 override**.

**R1 에 대한 함의 (측정값):**
- substrate split = **CLOSED 유지** (F9: 저장·파생 분리 확인).
- display join = **known exception** (F10). R1 재오픈 아님 — 문서화된 예외 각주.
- **display join does not imply storage-layer coupling.** (substrate split ≠ display separation — R1 보호.)

**결정 forward:**
> 이 join 이 만드는 충돌(avatar identity 가 Code 에 매핑되나 Archetype 에 매핑되나)은
> **RISK-1 = Commander product call (다음 트랙 #2)**. 본 baseline 문서는 fact 만 기록, 결정 미수행.

---

## §3  PARKED POINTERS (이 트랙에서 닫지 않음)

| ID | 내용 | 상태 | 사유 |
|----|------|------|------|
| Q2 | UI render surface 검증 | PARKED | precision-only; dormant=FALSE 판정에 불요 (F3/F4 충분) |
| RISK-2 / 2b | archetype persistence + schema/runtime drift | PARKED | migrations-hold 의존; read-only 트랙 밖 |
| OBS-1 | ownership·time = archetype 7개 모두 미커버 (10/12) | PARKED → **Avatar Mapping Track Prerequisite Note #1** | 매핑 범위(12축 전체 vs archetype-10축) 결정 입력값 |
| RISK-3b | Resilience·Gratitude 축 미도달 | PARKED | 별도 백로그, 이 트랙 밖 |

> OBS-1 산술 출처: F2 distinct-axis union = {truth, accountability, integrity, authority, control, courage, identity, visibility, repair, conflict} = 10. 미참조 = {ownership, time}. (재측정 아님 — F2 데이터 산술.)

---

## §4  STATUS

- R3 Measurement: **CLOSED** (corrected baseline).
- Avatar↔Axis: **D** (CLOSED).
- Archetype↔Axis: **B** (CLOSED; NIGHTFORGE = A 예외).
- R1 substrate-split: **CLOSED** + F10 display-join exception 부착.
- 다음: #2 Commander product call (RISK-1) → #3 Avatar Mapping Track (HOLD until #1·#2).
- 본 문서 = baseline 정정 only. 매핑/설계/lore/avatar canon 미포함.
