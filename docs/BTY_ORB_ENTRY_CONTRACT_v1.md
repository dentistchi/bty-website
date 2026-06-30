# BTY_ORB_ENTRY_CONTRACT_v1

**Status:** DRAFT — Commander-authored · NOT repository authority until committed
**Track:** Product A spine · Arena Day-0 entry
**Authored by:** dispatch chat (NON-MUTATING). Repo write/commit/push = Claude Code only, after explicit Commander "go".
**Implements:** inner 6dec1cc2 (implementation provenance)

> 이 문서는 검토용 초안이다. lock·commit·push 전까지 권위 없음 (phantom lock = footgun).

**Provenance separation:** 측정 = Claude Code (read-only) · 검증 = dispatch arbiter · 의미 본문 = Commander 저작.
**Create-only:** 이 파일은 v1. 정정은 새 버전 파일로만(create-only) — locked prior byte 절대 수정 금지.

---

## §1 · MEANING CANON  (Commander-authored · 권위 본문)

> 이 절은 **의미**다. 상수·임계값·코드 식별자 **없음** (구현은 §2). 의미는 구현보다 위에 있다 — Canon ⊃ implementation.

Orb는 장식이 아니다. BTY의 **첫 의식(ritual)**이다. 하루는 버튼을 *누름*으로 열리지 않는다 — **머무름(holding)**으로 열린다.

**3-state 계약**

| State | 의미 | 행위 |
|---|---|---|
| **Touch** | attention — "나는 여기 있다" | 접촉 도착: 반응(빛·촉각)만, 이동 없음 |
| **Hold** | intention — "나는 머문다" | 누름 유지: 빛이 모인다 |
| **Commit** | point of no return — "오늘이 열렸다" | 충분히 머문 상태에서 한 번 발화 |

**경계 규칙 (의미)**
- **Release BEFORE commit = nothing begun.** 의도에 도달하기 전 떠나면 — 아무 일도 없다. 하루는 시작되지 않았다.
- **Release AFTER commit = day already open.** 의도에 도달한 뒤엔 떠나도 취소되지 않는다 — 하루는 이미 열렸다.

**Commit 신호는 침묵이다(silent).** commit에 새 haptic·새 진동 패턴 없음. **완전히 모인 빛의 상태**가 곧 commit 신호다 — 보는 것이 돌이킬 수 없음의 증거. (haptic 독점 = sibling lock, §3.)

**Day-0 정합.** 첫 진입은 사용자 과거 이력을 암시하지 않는다. 진입 의식은 매일 동일(persistent ritual)하며, Day-0 보조 힌트는 1회성·history 불암시.

---

## §2 · IMPLEMENTATION REFERENCE

> **⚠ measured mechanics — TUNABLE, NOT eternal meaning.** 이 절의 모든 수치(0.97 · ~2.4s 등)는 **측정값**이며 튜닝 가능하다. 튜닝 시 §1 의미 본문은 **건드리지 않는다.** 상수가 의미를 정의하지 않는다 — 의미가 상수를 허용할 뿐.

**측정 출처:** Claude Code read-only inventory (inner 6dec1cc2). Reality > Memory.

### 2.1 Gather 동역학 (측정됨)
- 적분: `g += dt · GATHER_K(0.85) · (GATHER_BASE(0.15) + g)`, 이어 `if (g>1) g=1`.
- **positive-feedback exponential** (자가가속) — asymptote 아님. **hard clamp로 g==1 SATURATE @ ~2.4s 연속 hold.**
- 곡선 = slow-start / late-rush. Sensory Gate 5/5 통과 자산 — **변경 금지** (단축 = Sensory 회귀).

### 2.2 Commit 검출 (측정값 기반 결정)
- Commit = **g-threshold `COMMIT_G = 0.97`** (관찰만), NOT hold-timer.
  - 근거: frame-drop 시 wall-clock timer는 빛이 덜 모인 순간에 fire → "fully-gathered = commit 신호" 위배. g 관찰은 시각 상태와 항상 일치.
  - 0.97 = clamp 직전 ~1 frame (late-rush라 0.97↔1.0 육안 동일). Commander intention-weight ≈ 2.4s hold.
- 발화 위치: clamp **직후** g 관찰만 → gather/settle 곡선 **byte-identical**.
- **Once-per-press latch:** `committedRef`(Orb), `beginPress`에서 reset. held-past-commit(g=1.0 고정) → 재발화 없음.
- **Navigate-once 이중 폐쇄:** `committedRef`(Orb, per-press) + `navigatedRef`(today, per-mount).
- 순수 함수 `shouldCommit(g, committed, COMMIT_G)` 추출 — 단위 테스트용, 상태 관찰만·곡선 무변형.

### 2.3 라우팅 / 표면
- 진입 = 기존 `beginHref` / `useArenaEntryResolution` 재사용 (새 static CTA 금지 — productArenaEntryGuard).
- latency: `router.prefetch(beginHref)` (resolution settle 후).
- Today Orb mode 현재 hardcoded `"morning"`.
- Day-0 힌트: localStorage `btyOrbHintSeen:v1` (BOOLEAN flag — day-key 아님·clock 미read·history 불암시), first commit에서 영구 소멸.

### 2.4 코드 위치 (inner 6dec1cc2)
- `bty-app/src/components/orb/Orb.tsx` — `onCommit?` · `COMMIT_G` · `shouldCommit()` · latch.
- `bty-app/src/app/[locale]/today/page.client.tsx` — Orb 진입 wiring · navigate-once · hint.
- `bty-app/src/lib/i18n.ts` — `orbHint` KO/EN.

### 2.5 검증 상태
- jsdom 7/7 PASS (shouldCommit 5 latch + handleCommit navigate-once) · tsc --noEmit 0. **단 jsdom은 latch 논리만 증명.**
- **PENDING (runtime):** 제스처 실측 4항 — (1) 0.97 fire = full-gather 순간 일치 · (2) hint 노출→소멸 · (3) async gap point-of-no-return 가시성 · (4) release-after 미취소. OAuth-gated → staging deploy 수동검증 유일 경로. **미배포.**

---

## §3 · RELATED LOCKS (상호참조)

- **`bty-app/docs/ORB_HAPTIC_EXCLUSIVITY_LOCK.md`** (#배타성 LOCK · inner sibling).
  - **방향:** 본 Entry Contract는 haptic lock에 **종속·준수**한다. commit은 **SILENT** — 새 `navigator.vibrate()` 호출 없음 → 단일 sanctioned site `triggerOrbHaptic()` 독점 불변. Entry Contract가 haptic lock을 **위반하지 않음을 명시**.
- **Placement 근거:** 의미(Touch/Hold/Commit) = 제품 의미 → 본 문서 = outer-root `docs/` (제품 canon peer, inner-absent). 구현 참조는 inner 코드를 가리키되 **권위는 outer 의미 본문**에 있다.

---

## §4 · AUTHORITY (권위)

- 권위 원천 = **Commander 의미 저작 (§1).** inner `6dec1cc2` = **implementation provenance**일 뿐, 권위 원천 아님.
- 이 문서는 commit 전까지 DRAFT(권위 없음). lock = Commander "go" → Claude Code가 outer `docs/` write→commit→push.
