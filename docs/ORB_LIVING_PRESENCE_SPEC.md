# ORB_LIVING_PRESENCE_SPEC

**Status:** LOCKED (canon)
**Date:** 2026-07-01
**Authorship:** Commander-authored. Bodies §A, §A-Appendix, and §B are Commander 원문 **verbatim**, preserved byte-for-byte inside fenced blocks. This file adds only structural framing, pointers, one footnote, and non-normative implementation notes — **no semantic edit to the 원문**.

---

## Related Canon (pointers only)

- **ORB_HAPTIC_EXCLUSIVITY_LOCK.md** — *inner-repo-resident* (`bty-app/docs/`), not in this outer `docs/` tree. Haptic 배타성 LOCK. **This spec is visual / particle / light / motion language ONLY. It introduces NO new haptic.** All haptic behavior remains governed solely by the exclusivity lock; nothing here adds or modifies a haptic call site.
- **Sensory Gate** — BTY's 4th standing gate ("눈으로 보기 전에 몸이 먼저 기억하는가" / PASS = "0.5초 뒤 또 만지고 싶은가", not "works"). Any implementation of this spec **MUST re-pass the Sensory Gate**. A correct implementation that does not pass the gate is not BTY-canon.

---

## §A — Orb Living Presence Spec (Commander 원문 verbatim)

> Verbatim source, preserved byte-for-byte. Do not edit (typos included — report only).

```
The Orb must stop feeling like an animated object.
It must feel like a living companion.
The difference is critical.
A living thing does not simply react.
It perceives.
It decides.
Then it responds.
The Orb should always exist in a subtle living state, even when untouched.
------------------------------------
BASE STATE (Idle)
------------------------------------
The Orb is never completely still.
It should have an almost imperceptible breathing rhythm.
• very slow inhale/exhale
• 1~2% volume expansion
• tiny movement of the energy core
• extremely slow circulation of particles
The breathing should feel organic, not mechanical.
No obvious looping.
The user should feel:
"It is quietly alive."
------------------------------------
APPROACH AWARENESS
------------------------------------
The Orb should begin reacting BEFORE touch.
When a finger approaches:
• surface glow subtly leans toward the finger
• nearby particles become curious
• the energy core slightly shifts
• breathing becomes slightly more attentive
The reaction should begin before contact.
The Orb should feel as if it notices the user's presence.
Never wait until touch.
------------------------------------
TOUCH STATE
------------------------------------
Touch should never simply move the Orb.
Instead,
the finger becomes a temporary gravitational center.
Particles from every direction slowly converge toward the touch point.
Not pushed.
Not translated.
Pulled.
Like gravity.
Every particle chooses the shortest natural path.
Different particles arrive at different times.
No synchronized movement.
The user should feel:
"The Orb is gathering itself into my hand."
------------------------------------
ENERGY CORE
------------------------------------
The center of the Orb is alive.
When touching,
the energy core migrates beneath the finger.
It should never instantly snap.
Instead:
notice
↓
drift
↓
arrive
↓
stabilize
Like attention moving.
------------------------------------
BREATH + TOUCH COUPLING
------------------------------------
Touch affects breathing.
Breathing affects particles.
Particles affect light.
Everything is connected.
During touch:
• breathing slightly accelerates
• pulse becomes deeper
• glow becomes denser
• particles move with greater intention
After release:
breathing slowly returns to normal.
------------------------------------
RELEASE MEMORY
------------------------------------
When the finger leaves,
the interaction should not instantly end.
Instead:
linger
↓
remember
↓
release
Particles remain gathered briefly.
Light slowly disperses.
The energy core hesitates before returning.
Duration:
approximately 0.6~1.0 seconds.
The Orb should feel reluctant to disconnect.
------------------------------------
MICRO IMPERFECTION
------------------------------------
Never move perfectly.
Introduce tiny organic variation.
Different particles react with slightly different timing.
Small delays.
Small randomness.
Tiny imperfections.
Life exists inside imperfection.
------------------------------------
EMOTIONAL GOAL
------------------------------------
The user should never think:
"I touched an animation."
Instead the user should feel:
"It noticed me."
"I interrupted its breathing."
"It gathered around my hand."
"It stayed with me after I let go."
------------------------------------
DESIGN RULE
------------------------------------
Do not optimize for visual effects.
Optimize for perceived awareness.
The Orb should never chase the finger.
It should acknowledge the person.
Every motion must communicate intention.
The Orb is not a button.
The Orb is BTY's first living companion.
```

**Footnote — [§A · APPROACH AWARENESS]:** iPhone has no hardware hover. The APPROACH AWARENESS section above is *intent*; **§B REALITY-BOUND TRANSLATION (LOCK) is the implementation standard.** (원문 미수정 — this footnote is additive only.)

### §A Appendix (Commander 원문 verbatim — 원문 후미 지시문)

```
Imagine the Orb as a small living creature that has no eyes, no mouth, and no voice.
Its only way to communicate is through light, breathing, particles, and movement.
Every animation must express awareness, curiosity, calmness, connection, or release.
Never animate because motion looks beautiful.
Animate because the Orb is experiencing something.
```

---

## §B — APPROACH AWARENESS: REALITY-BOUND TRANSLATION (LOCK)

Commander 원문 verbatim (LOCK DECISION 한국어부 + 영어 번역부 전체), preserved byte-for-byte. Quote characters preserved exactly as received.

```
LOCK DECISION
Approach Awareness = 구현상 hover 감지가 아니다.
BTY Orb에서 approach는 두 신호로 번역한다.
1. Screen-entry awareness
- 사용자가 Orb 화면에 진입하는 순간
- Orb는 이미 사용자를 감지한 것처럼 breathing이 살짝 깊어지고 attentive state로 전환된다.
2. Touch-down awareness
- 실제 터치 순간 즉시 폭발하지 않는다.
- notice delay 약 60~100ms
- particles lean
- core drift begins
- 그다음 touch gravity가 시작된다.
금지:
- iPhone hover 감지 구현 시도 금지
- 새 haptic 추가 금지
- touch-down 즉시 flare 폭발 금지
의도:
사용자는 "손가락이 감지됐다"가 아니라 "Orb가 나를 알아차렸다"고 느껴야 한다.

APPROACH AWARENESS — REALITY-BOUND TRANSLATION
The Orb cannot rely on hardware hover detection on iPhone.
Therefore, "approach" is expressed through two available signals:
1. Screen Entry
When the user enters the Orb surface, the Orb subtly becomes more attentive.
The breathing deepens slightly.
The energy core becomes more awake.
This is the Orb noticing that the user has arrived.
2. Touch-Down Recognition
When touch begins, the Orb should not instantly explode into animation.
It should first show a brief recognition phase:
notice → lean → gather
Within the first 60–100ms, particles subtly orient toward the touch point.
Then the gravity-based gathering begins.
The goal is not true pre-touch sensing.
The goal is perceived awareness.
The Orb should feel like it noticed the user, not like a button received input.
```

**LOCK — 금지 3항** (원문 §B에서 발췌; 신규 문안 아님):
- iPhone hover 감지 구현 시도 금지
- 새 haptic 추가 금지
- touch-down 즉시 flare 폭발 금지

---

## Implementation Notes (informative, non-normative)

These notes are **not canon**. They guide a future implementation dispatch and may be revised there.

- **Rendering:** the particle system may exceed CSS limits — canvas / WebGL likely required. Decision deferred to the implementation dispatch.
- **Verification surface:** `/dev/orb` (auth-free preview).
- **Performance gate:** 60fps + battery. Concrete thresholds are defined in the implementation dispatch, not here.

---

## §C — Discovered Principles (Phase A, 2026-07-01)

Commander-authored experience principles that surfaced during Phase A Sensory Gate iteration. Bodies are **verbatim**, preserved byte-for-byte (arrows →/↓, `*` bullets, and quote characters as received; typos preserved — report only). The one-line **titles are a structural frame added here (NOT 원문)**.

### §C-1 — 빛의 원인이 움직여야 한다

```
지금 Orb는 빛이 움직입니다.
제가 원하는 것은
빛의 원인이 움직이는 것입니다.
그 차이는 매우 작지만, 사용자는 무의식적으로 구분합니다.
* 빛이 움직인다 → 특수효과
* 무언가가 빛을 만들어낸다 → 생명
BTY의 Orb는 두 번째가 되어야 합니다.
```

### §C-2 — Core → Propagation → Body

```
숨을 쉬는 것은 구가 아니라 "코어"여야 합니다.
Core
↓
Propagation
↓
Body
살아있는 것은
항상
안쪽이 먼저입니다.
The center should always lead.
The shell should always follow.
Think of a heartbeat hidden beneath skin,
not a balloon inflating.
Change the order of motion,
not the amount of motion.
```

### §C-3 — 완벽한 주기는 죽은 것 (숨에도 감정이 있다)

```
생명에는 "의식의 변화"가 있습니다.
숨에도
미세한 감정이 있어야 합니다.
Do not make breathing perfectly periodic.
Avoid randomness.
Instead create natural biological rhythm.
The user should never notice the variation consciously.
They should only feel
that the Orb is alive.
```

### §C-4 — 정적도 호흡의 일부

```
생명은
완벽한 사인파가 아니기 때문입니다.
The Orb should sometimes simply exist.
Not every moment needs movement.
Life is communicated as much through stillness
as through motion.
Silence is part of breathing.
```

### §C-5 — 생명은 감산으로 만들어진다

```
생명은 움직임을 추가해서 만들어지지 않았다.
움직임을 줄이면서 만들어졌다.
처음에는 더 많은 효과를 넣을수록 살아있을 것 같았지만,
실제로는
* 과한 움직임을 빼고
* 규칙성을 깨고
* 고요함을 남겼을 때
비로소 존재감이 생겼습니다.
이 원칙은 Orb뿐 아니라 앞으로 BTY의 Companion, Avatar,
Center까지 모두 적용될 수 있는 중요한 경험 원칙이라고 생각합니다.
```

**Footnote (non-normative) — §C-5:** Candidate for promotion beyond Orb scope per Constitution convergence rule — promote only if the same Order re-surfaces independently on another surface (Companion / Avatar / Center).

---

## §D — Phase B Principles (design-time, Commander-authored, 2026-07-01)

Unlike §C (discovered during implementation), these are **authored before implementation** — the principle exists first, the code follows (Canon → Implementation). Bodies are **verbatim**, preserved byte-for-byte (arrows →/↓, `###` sub-labels, quote characters as received; typos preserved — report only). The one-line **titles are a structural frame added here (NOT 원문)**.

### §D-1 — Attention = Transition

```
Attention은 State가 아니라 Transition입니다.
Attention은
Idle에서 Relationship으로 넘어가는 문입니다.
Touch
↓
Notice
↓
Attention
↓
Core Drift
↓
Propagation
↓
Particles
↓
Connection
새로운 State를 만들지 않습니다.
```

### §D-2 — Influence Field (감산 적용)

```
생명은
모두가 반응하지 않습니다.
Core
↓
Near Field
↓
Middle Field
↓
Far Field (거의 무반응)
### Near Field
즉시
반응합니다.
### Middle Field
조금 늦게
합류합니다.
### Far Field
거의
움직이지 않습니다.
그냥
조금
기울어질 뿐입니다.
사용자는
"구 전체가 움직였다."
가 아니라
"안에서 영향이 퍼졌다."
를 느낍니다.
Touch Gravity는
Gravity가 아니라
Influence Field에 더 가깝습니다.
```

### §D-3 — 3단계 분할 + Sensory Gate 질문

```
B-1 Relationship begins:
Touch → Notice → Attention → Core Drift → Stabilize
입자는 거의 안 움직입니다. 핵심은 "알아차림."
Sensory Gate: "나를 본 것 같은가?"
B-2 Influence:
Core → Near Field → Middle Field
여기서 처음으로 입자가 모입니다.
Sensory Gate: "끌려오는 것 같은가?"
B-3 Release:
Release → Memory → Return
Sensory Gate: "헤어지기 싫어하는가?"
각 단계마다 독립 Sensory Gate 통과 후 다음 단계 진행.
```

### §D-4 — No Pursuit (Invitation)

```
The Orb does not chase.
It acknowledges.
It notices.
It welcomes.
But it never follows like a cursor.
Connection is created by invitation,
not pursuit.
The Orb never pursues the user. It simply lets the user
know they have been noticed.
```

### §D-5 — Attention Refresh (Intention, not Velocity)

```
The Orb never chases motion.
It updates attention.
Fast motion is ignored.
Slow intention is acknowledged.
Rule:
Fast movement → Ignore
Slow movement → Gradual realignment
Follower가 아니라 관심의 갱신입니다.
Cursor Follow는 금지하지만 Attention Refresh는 허용합니다.
Refresh는 별도의 애니메이션이 아닙니다.
Core Drift를 매우 낮은 속도로 재목표화(retarget)하는 것입니다.
The Orb never chases motion.
It only updates attention.
Attention follows intention,
not velocity.
```

### §D Anchor

```
The Orb does not follow where your finger goes.
It follows where your intention settles.
```

---

## §E — B-1 Discovered & Authored Principles (2026-07-02)

Commander-authored during Phase B-1 / B-1.5 Sensory Gate iteration. Bodies are **verbatim**, preserved byte-for-byte (arrows →, quote characters, and mixed KO/EN as received; typos preserved — report only). The one-line **titles are a structural frame added here (NOT 원문)**.

### §E-1 — Volumetric Living Light

```
The Orb should not contain particles.
The Orb should contain living light.
Particles should only emerge
when the eye naturally detects
small density variations
inside that light.
If the viewer can count particles,
the illusion has failed.

Particle System을 만드는 것이 아니라
Volumetric Light를 만드는 것처럼 생각해야 합니다.
순서: Continuous Light → Density fluctuation
→ Occasionally perceived as particles.
```

### §E-2 — 가시성 계층

```
95% — 거의 안 보임
4% — 희미하게 보임
1% — 잠깐 드러남
숫자가 아니라 존재감이 중요합니다.
```

### §E-3 — Forbidden Outcome

```
The eye must never lock onto
individual particles.
The eye should naturally settle
on the Orb itself.
If a viewer starts tracking dots,
the rendering has failed.
```

### §E-4 — 4계층 해부학

```
Seed: life origin. 거의 보이지 않음.
Attention Core: 사용자를 알아차리고 drift함.
Energy Field: 손가락을 직접 보지 않음.
Attention Core를 늦게 따라감.
Shell: 가장 늦고 가장 약하게 반응.

심장 → 신경 → 근육 → 피부.
피부가 먼저 움직이지 않습니다.
onset 계단: Seed 0ms → Attention ~40ms
→ Energy ~120ms → Shell ~180ms.
새로운 원을 추가하지 말고, 새로운 역할을 추가해야 합니다.
구조는 4단계지만, 시각적으로는 여전히 3단계처럼 보여야 합니다.
```

### §E-5 — Energy Follows Attention

```
The Energy Field must never chase the finger.
It may only follow the Attention Core,
with delay, damping, and reduced amplitude.
This preserves no-chase while preventing
core-medium separation.

Energy does not follow the finger.
Energy follows Attention.
Attention is allowed to notice the user.
Energy is only allowed to respond to Attention.
```

### §E-6 — One Living Body

```
The Orb should not appear as:
moving core + leftover particles.
It should appear as:
one living luminous body whose attention has shifted.
```

### §E-7 — Sensory Gate 4문 체계

```
1. 나를 본 것 같은가?
2. 점이 아니라 빛으로 보이는가?
3. 시선이 입자가 아니라 Orb 전체에 머무는가?
4. Touch/drift 중에도 Orb가 한 몸으로 보이는가?
```

**Footnote (non-normative) — §E-4:** Seed depth (Seed reveals only in deep moments — long touch, relationship formation) = registered as B-2 design input, not locked here.

---

## §F — Today Surface Activation (v0.1 Daily OS) — Commander-authorized amendment (2026-07-03)

**Status:** NORMATIVE for the BTY Daily OS v0.1 Today surface only
(/[locale]/today, OrbLiving @160px). Additive — no edit to the verbatim
§A–§E bodies. **Partially supersedes** the B-1.5 cohesion principle for this
surface: the **Attention Core remains core-anchored** (B-1.5 "never chase the
finger" is preserved for the core), while a **new secondary Influence Field
(B-2)** may gather toward touch (§B "gather" · §D Touch Gravity), otherwise deferred.

**Commander directive (verbatim, 2026-07-03):**
> core가 손가락을 따라가면 안 된다.
> central anchor는 유지한다.
> 다만 secondary influence field가 손끝 방향으로 아주 느리게, 넓게, 무겁게 모인다.

**Implementation standard (this surface):**
- **Attention Core anchored** — the bright center does NOT translate toward touch; idle
  micro-drift + breath only (stable heart, §C-2).
- **Secondary Influence Field (B-2)** gathers toward the touch point **very slowly, widely,
  heavily** — soft, wide, delayed/inertial; light *density* is drawn toward the finger, the
  core does not move.
- **Preserved:** visual-only; **haptic-free** (exclusivity sole-site remains Orb.tsx — §9 /
  ORB_HAPTIC_EXCLUSIVITY_LOCK intact); deterministic reaction (input = touch coordinate/time
  only); gradient-only softness (no hard stroke/blur); no WebGL; no new dependency.
- **Still deferred (unchanged):** release memory (B-3), approach/hover sensing, production-wide
  touch gravity beyond this surface, any haptic.

**Mandatory re-gate:** must re-pass the Today-surface Sensory Gate (§E-7) on `/ko/today` +
`/en/today`. No final Sensory PASS before Commander confirms.

---

## §G — Threshold Door Surface (v0.1 Daily OS) — Commander-authorized amendment (2026-07-03)

**Status:** NORMATIVE for the BTY Daily OS v0.1 **`/[locale]/start` Threshold only.**
Additive — no edit to the verbatim §A–§E bodies. Companion to §F: §F governs the **Today**
B-2 touch influence field; §G authorizes OrbLiving as the living **Threshold Door**.

**Product lock (Commander):** The Orb is the **door**; the Today screen is the revealed room.
The door opens Today and does not remain large inside the room after entry.

**Threshold Door standard (`/start`):**
1. `/start` **may render OrbLiving** as the living Threshold Door — **visual-only, haptic-free**.
2. Threshold Door size is authorized at **220px** (separate from the Today §F **160px**).
3. `/start` remains **data-free**: no `daily-gate-check` fetch, no `relationship-pulse` fetch,
   no server interpretation.
4. `/start` tap/commit **may navigate to `/today`**; it must **not** self-terminate into
   mini-Today as the final revealed state.
5. **Haptic decision (v0.1):** the Threshold Door chooses living **visual presence over
   press-haptic**. The previous production `Orb.tsx` press-haptic on `/start` is **not used**;
   its loss is **intentional and accepted for v0.1**. This does **not** weaken
   ORB_HAPTIC_EXCLUSIVITY_LOCK — it prevents adding haptic logic into OrbLiving. OrbLiving
   **must not add haptics**; `Orb.tsx` remains the sole sanctioned haptic site. Haptic
   reintegration requires separate canon (v0.2).

**Reveal separation (`/today`):** the reveal content (Relationship Pulse → Today Choose One →
Center / Arena / Foundry → Exit) belongs **after** the Orb door is opened; `/today` must **not**
render the large Orb as decoration after reveal.

**If the §F B-2 Influence Field is reused on `/start`,** it is allowed only under §G constraints:
central core **anchored**; **secondary field only**; **haptic-free**; visual-only; **no server
data**; no hover/approach; no production-wide touch gravity.

**Still deferred (unchanged):** B-3 release memory, approach/hover sensing, production-wide touch
gravity, **OrbLiving haptic integration**, physics/WebGL, multi-pointer/force systems.
