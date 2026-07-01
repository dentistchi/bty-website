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
