# BTY_AVATAR_PLATFORM_ARCHITECTURE_v1

**Status:** LOCKED v1.0 — Commander-approved · COMMITTED
**Track:** post-launch architecture (launch 우선순위 미침범)
**Authored by:** dispatch chat (NON-MUTATING). Repo write / commit / push = Claude Code only, after explicit Commander "go".
**Inventory basis:** Avatar Platform Inventory — verdict **PASS WITH RECLASSIFICATION**
**Commit:** `<this outer>`

> 이 문서는 검토용 초안이다. lock·commit·push 전까지 권위 없음 (phantom lock = footgun).
> BTY Avatar는 이미지 에셋이 아니다. **BTY 행동 엔진에 연결된 상태 구동 캐릭터 런타임**이다.
> 앞으로 만드는 모든 캐릭터(Dr. Chi · 12축 · Legend 13 · User Avatar · Today Me · Center Companion)는 이 문서의 자식이다.

---

## LOCK-0 · LAYER STACK (최상단 · 절대 불변)

BTY의 본질은 **패턴 감지 / 행동 강제 / 재노출 / 검증**이다. Avatar는 그 엔진의 **표현 계층**이다. 절대 엔진 계층이 아니다.

```text
Layer 0   Leadership Engine          ← 결정. 패턴 감지 / 행동 강제 / 재노출 / 검증
   ↓
Layer 1   AI Routing Engine          ← 톤 / 개입수준 / 모드 판정 (Arena · Center · Foundry 분리)
   ↓
Layer 2   Avatar Platform            ← 상태를 표현 (THIS DOCUMENT)
   ↓
Layer 3   Runtime Adapters           ← Visual Runtime (Rive / Live2D / Unity / Three.js)
                                       + Conversation Runtime (GPT)
```

**LOCK-0 불변 조항**
- Avatar Platform은 Layer 0·1의 결정을 **표현**만 한다. 결정하지 않는다.
- GPT/LLM은 표정·상태를 직접 정하지 않는다. Routing Engine이 상태를 정하고 Avatar는 그 상태를 받는다.
- 이 stack을 위반하는 어떤 후속 설계도 무효다. **1년 뒤 Avatar가 엔진을 삼키는 것을 막기 위한 load-bearing 조항.**

상위 권위: `LEADERSHIP_ENGINE_SPEC.md` (Layer 0) · AI Routing Engine 명세 (Layer 1). 본 canon은 이들 **아래**에 종속된다.

---

## 1. 핵심 판정 — Avatar는 무엇인가

과거 문서들은 서로 다른 3개 개념을 "Avatar" 한 단어로 섞어 놓았다. 이 혼재가 충돌의 유일한 원인이었다 (4건처럼 보였으나 실제 1건).

| Layer | 개념 | 정체 | 소스 계열 |
|---|---|---|---|
| **A. User Representation** | 나를 닮은 캐릭터 · 사진 기반 · 외형 커스터마이징 | 사용자 분신 (나를 표현) | PHASE_3_1 계열 (User Likeness Track) |
| **B. Leadership Representation** | 12 Axis · Legend 13 · Code Name · Identity State | BTY 고유 행동 거울 | Axis Canon 계열 |
| **C. Companion Representation** | Dr. Chi · Center Companion · Recovery Companion | AI 관계형 캐릭터 | Companion 계열 |

- 과거 문서 = **A + B** 혼재
- 신규 플랫폼 설계 = **B + C**
- → 겹치는 B에서 충돌처럼 보였을 뿐. A·B·C 분리 시 충돌 소멸.

**Today Me는 Companion Representation이 아니라 Self Reflection Mirror다.** `USER_AVATAR`가 "나를 표현"한다면 `TODAY_ME`는 "현재 상태를 표현"한다. 세 표현 계층(A·B·C) 어디에도 종속되지 않는 BTY 고유 거울 계층이다.

**본 canon은 A·B·C를 같은 Character Data Model 뿌리에서 자라되 서로 다른 Class로 분리한다.**

---

## 2. Character Class Taxonomy (6 classes · 확정)

```text
USER_AVATAR          ← Layer A. 사용자 본인 닮은 아바타 (PHASE_3_1 / User Likeness Track)
COMPANION            ← Layer C. Dr. Chi 등 관계형 AI 캐릭터 (premium rig)
AXIS_AVATAR          ← Layer B. 12축 행동 패턴 시각화
NPC                  ← Scene 행위자
TODAY_ME             ← Self Reflection Mirror (현재 상태 표현 · 사용자 분신 아님)
RECOVERY_COMPANION   ← 회복 / 안전 밸브 동행
```

**Role은 Class가 아니다 (별도 축):**

```text
role: mentor | guide | coach | observer
```

**Class 경계 LOCK**
- **MENTOR는 Class가 아니라 Role.** Dr. Chi는 초기 `mentor` → 나중 `companion` 관계 → 나중 Center `guide`로 역할이 옮겨갈 수 있다. 동일 `COMPANION` 인스턴스에 `role`만 바뀐다. Mentor를 Class로 박으면 Dr. Chi가 역할을 옮길 때마다 새 캐릭터가 된다.
- **`USER_AVATAR` ≠ `TODAY_ME`.** `USER_AVATAR`는 *나를* 표현하고, `TODAY_ME`는 *현재 상태를* 표현한다. Today Me는 Companion이 아니라 **Self Reflection Mirror**다. AIR low이면 Today Me 표정이 달라지고, LRI high이면 Today Me가 달라진다 — Layer 0/1 상태를 그대로 거울처럼 비춘다. **이건 BTY만의 독특한 영역.** 영구 분리.
- `COMPANION`(Dr. Chi)은 `AXIS_AVATAR`(12축)와 동일 스펙으로 묶지 않는다. Companion = 관계형 anchor, Axis = 행동 거울. Dr. Chi 약화·12축 제작비 폭증 방지.
- VISION 문서의 "단일 가이드 캐릭터" 철학은 폐기 아님 → **`COMPANION → Dr. Chi`로 수렴.** 철학 유지, 구현 방식만 변경.

**Legend 13 = RESERVED.** 현재 Legend 13이 Character인지 State인지 Unlock인지 미결정. **본 canon에서 정의하지 않는다.** RESERVED 표기만 하고 종료.

---

## 3. Character Data Model Canon (the spine)

> Commander 우선순위 #1: Rive 결제 후 가장 중요한 다음 작업은 캐릭터 제작이 아니라 **이 데이터 모델**이다.
> 이 뿌리가 생기면 Dr. Chi · 12축 · Legend 13 · User Avatar · Today Me · Center Companion이 전부 같은 뿌리에서 자란다.

모든 6개 클래스는 단일 base 모델을 공유한다. 클래스별 확장만 다르다.

```ts
type BtyCharacter = {
  id: string;
  class:
    | "user_avatar" | "companion" | "axis_avatar"
    | "npc"         | "today_me"  | "recovery_companion";
  role?: "mentor" | "guide" | "coach" | "observer";   // Role ≠ Class. Dr. Chi: mentor → companion → guide
  representationLayer: "A_user" | "B_leadership" | "C_companion";

  // Layer 3 — Character Runtime = Visual + Conversation
  visualRuntime: "rive" | "live2d" | "three" | "unity" | "static_export";
  conversationRuntime?: "gpt" | "none";

  visualBase: string;        // base(얼굴/몸) 키
  expressions: string[];     // neutral / warm / focused / concern / recovery_soft / challenge / celebration
  outfits: string[];         // default / role / seasonal / rank / achievement
  accessories: string[];     // badge / tool / aura / background_symbol / earned
  animations: string[];      // idle / listen / speak / reflect / encourage / redirect / celebrate / recover

  // 1급 객체로 승격 (was behaviorBindings) — BTY는 행동 엔진 기반이므로 행동 상태가 일급
  behaviorProfile: {
    mode: "arena" | "center" | "foundry";
    stateBand: "low" | "mid" | "high";
    interventionLevel: "L0" | "L1" | "L2" | "L3" | "L4";
  };

  aiPersonaId?: string;       // Layer 1 prompt_persona 참조 (Companion)
  axisBinding?: string;       // AXIS_AVATAR 전용 → Axis Canon 참조 (재정의 금지, §5)
  likenessSource?: "photo" | "preset"; // USER_AVATAR 전용
};
```

### 3.1 Class별 확장 (scaffold — Commander 본문 저작 대기)

| Class | 전용 필드 | 비고 |
|---|---|---|
| `USER_AVATAR` | `likenessSource`, 외부 SDK 어댑터 참조 | User Likeness Track 소관. RPM 종료(2026-01-31) 반영 — 대체 SDK 선정은 해당 트랙 |
| `AXIS_AVATAR` | `axisBinding` → AxisVector | **§5 deferral. axis 정의는 기존 Axis Canon lock 소유. 본 canon 재정의 금지** |
| `COMPANION` | `mentorPersona`, `conversationMemory`, `safetyRouting`, `companionTrustState`, `role` | Dr. Chi premium rig. DR_CHI_VOICE_TRAINING / HEALING_COACHING_SPEC_V3 입력. role로 mentor/guide/coach 전환 |
| `TODAY_ME` | `stateBandVisual` (AIR / LRI 등 상태 반영) | Self Reflection Mirror. Layer 0/1 상태를 거울처럼 표현 |
| `NPC` / `RECOVERY_COMPANION` | — | scaffold |

**상태 흐름**

```text
User input → Layer 0/1 (mode_after / intervention_level / coach_tone)
          → behaviorProfile → Visual Runtime State Machine
                            → Conversation Runtime (GPT, Companion 한정)
```

---

## 4. Runtime Adapter 정책 (Layer 3)

Character Runtime은 두 축이다. **Visual Runtime + Conversation Runtime.** Dr. Chi는 애니메이션만 있는 존재가 아니다.

```text
Character Runtime
├─ Visual Runtime        → Rive / Live2D / Three / Unity / Static Export
└─ Conversation Runtime  → GPT
```

**Visual Runtime**

| 런타임 | 역할 |
|---|---|
| **Rive** | 1차 — Axis Avatar / Today Me / Center Companion / NPC / rank visual / cosmetics |
| **Live2D** | 프리미엄 Companion — Dr. Chi 고품질 얼굴·감정 |
| **Three.js** | 웹 3D 아이템 / 배경 / trophy / rank artifact / cosmetic preview |
| **Unity** | 장기 — BTY Room / Arena space / immersive mode |
| **Static Export** | 폴백 (현재 라이브 정적 PNG 합성 모델, §6) |

**Conversation Runtime**

| 런타임 | 역할 |
|---|---|
| **GPT** | Companion(Dr. Chi)의 대화 계층. Layer 1 Routing Engine이 상태를 정한 뒤 톤·발화 생성. 표정·상태는 정하지 않음 (LOCK-0) |

예: Dr. Chi = Visual Runtime(Rive/Live2D) + Conversation Runtime(GPT). 둘은 분리된 축이며 `BtyCharacter`에 각각 `visualRuntime` / `conversationRuntime`로 명시된다.

표준 Rive State Machine 입력(최소): `mood / mode / speaking / listening / celebrating / concerned / rank / outfit / accessory`.

---

## 5. Axis Canon Deferral (dueling-canon 방지 · 필수)

Layer B의 axis 정의·정체성은 **기존 lock 문서가 소유한다. 본 canon은 절대 재정의하지 않는다.**

상위 권위 (변경 금지):
- `BTY_AXIS_CANON.md` (v1.0) + `BTY_AXIS_CANON_v1_1_ADDENDUM.md` (v1.1)
- `BTY_CHARACTER_AXIS_GOVERNANCE_LOCK.md` · `BTY_PATTERN_FAMILY_AXISVECTOR_COVERAGE_LOCK.md`
- canonical path: `pattern_family → normalizePatternFamilyId → AxisVector`

**RESERVED 이름 경고:** 제안된 12 Axis Actor 이름 중 7개(STILLWATER, QUIETFLAME, IRONROOT, CLEARANCHOR, TRUEBEARING, OPENHAND, NIGHTFORGE)는 `rules.ts` RULE_REGISTRY의 라이브 archetype 정체성(100+ 테스트 소비)과 충돌 → **RESERVED (PROHIBITED 아님)**. Axis Actor 명명 시 충돌 회피 필요.

---

## 6. 기존 문서 종속 지도 (Inventory 결과)

| Tier | 문서 | 본 canon 대비 상태 |
|---|---|---|
| **Upstream 권위** | `LEADERSHIP_ENGINE_SPEC.md` | Layer 0 — 본 canon의 **상위** |
| **HOLD (미접촉)** 🔒 | `MY_PAGE_IDENTITY_CONSOLE_V1.md` (Leadership Identity) · Avatar Mapping | **ALL HOLD. 본 canon 설계 대상 아님** |
| **A — User Likeness Track** | `PHASE_3_1_AVATAR_SERVICE_SELECTION.md` · `AVATAR_AND_CHARACTER_VISION.md`(부분) | `USER_AVATAR` 클래스로 재분류. **deprecated 아님** |
| **B — Axis Canon** | Axis Canon lock 4종 | §5 deferral. 상위 |
| **C — Companion 입력** | `GUIDE_CHARACTER_ASSET` · `PHASE_1_3` · `PHASE_4_CODE_GUIDE_SKIN_SPEC` · `DR_CHI_VOICE_TRAINING` · `HEALING_COACHING_SPEC_V3` · `MENTOR_DEPTH_*` | `COMPANION` 클래스 입력 (mentor는 role). 종속·호환 |
| **현재 라이브 구현 (SUBORDINATE)** | `Avatar_System_Spec.pdf`(formal) · `AVATAR_LAYER_SPEC.md` · `ARENA_CODENAME_AVATAR_PLAN.md` · `ARENA_OUTFIT_SELECTION_SPEC.md` · `ARENA_AVATAR_NEXT_STEPS.md` | 정적-2D 합성 모델 = `static_export` 어댑터. layer 모델 호환. 신규가 위에 올라감 |
| **운영/직교 (COMPATIBLE)** | `AVATAR_ASSETS_TROUBLESHOOTING` · `AVATAR_DEPLOY_VERIFY` · `AVATAR_LEADERBOARD_STORAGE` · `LEADERBOARD_AVATAR_VISIBILITY` · `JOURNAL_AVATAR_UI_OPEN_ITEMS` · `OTHER_PC_LEVEL_AVATAR_NOT_VISIBLE` | Storage/배포 계층. 충돌 없음 |
| **거버넌스 STALE** | `CURSOR_TWO_TRACKS_AVATAR` · `CURSOR_AVATAR_*_TASK` (3종) | Cursor 실행모델 폐기됨. 내용 참고 가능, 실행지시 무효 |

---

## 7. Honesty Clause

> **current implementation ≠ permanent definition. Canon is above implementation.**

본 canon의 6클래스·데이터 모델은 구조 정의다. 현재 라이브 정적-2D 합성 모델(`static_export`)은 구현 시점 상태이지 영구 정의가 아니다. Rive/Live2D 전환은 구현 변경이며 canon은 그 위에 있다.

---

## 8. 본 canon이 하지 않는 것 (scope 경계)

- ❌ 12 Axis 정의·정체성 (→ Axis Canon lock 소유, §5)
- ❌ Legend 13 정의 (→ RESERVED, §2)
- ❌ Leadership Identity / Avatar Mapping 설계 (→ ALL HOLD 🔒)
- ❌ User Likeness SDK 선정 (→ User Representation Track 소관)
- ❌ 캐릭터 에셋 제작 / Rive 파일 (→ 데이터 모델 확정 후)
- ❌ 제품 기능·UI 변경

## 9. Commander 저작 대기 scaffold

- [ ] §3.1 Class별 expression/animation 본문 정의
- [ ] Dr. Chi Companion premium rig 별도 문서 (`DR_CHI_COMPANION_RIG_SPEC_v1`) — Visual + Conversation Runtime 양축
- [ ] Axis Actor 명명 (RESERVED 7종 회피, §5)
- [ ] `USER_AVATAR` SDK 어댑터 — User Likeness Track 결정 반영
- [ ] Legend 13 — RESERVED 해제 시 Character/State/Unlock 결정 (별도 Commander 판정)

---

**다음 단계:** Commander 검토 → 승인 시 Claude Code dispatch (outer repo write + commit + push, co-track convention) → lock → authority 발효.
