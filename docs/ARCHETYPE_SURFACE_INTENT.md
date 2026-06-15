# ARCHETYPE_SURFACE_INTENT

> Fact-fixing document (canon 신설 아님). **Time-scoped** — "현재 의도" 기록, "영구 금지" 선언 아님.
> 종속: `BTY_AVATAR_IDENTITY_LOCK.md` 의 종속 사실 문서 — 락 무수정, 새 lock 조항 0.
> Semantic scaffold = 측정 트랙. 의미 문장 = Commander.

---

## §0  PROVENANCE

- #1 F10 override reconciliation **CLOSED** (`b58f747`, outer origin/main) — My-Page Identity 슬롯 = Code(FORGE), Archetype 주입 제거.
- #2 Archetype/State surface 측정 (read-only inventory) — **위반 0 · gap 1**: State surface(PATTERN SIGNATURES / Leader) 위반 A/B/C clean; Archetype rollup(7) live surface = 0.
- (다) 위 측정이 아래 "의도 판정"의 근거 — 측정이 신설 필요 여부를 결정.

---

## §1  SURFACE INTENT (5 facts)

### 1. Pattern Signatures = Canonical State Surface
`user_pattern_signatures` (pattern_family 단위, **live**) — `current_state`(active/unstable/improving/resolved) · Last Shift · Confidence · Watch 어조. State("현재 관찰 패턴")의 정규 표시면.
근거: `UserPatternSignaturePublic` [patternSignature.types.ts]; render [PatternSignaturePanel.tsx:95,101,114,132].

### 2. Archetype Rollup (7) = Compute / Persist Only
`resolveArchetypeForUser` 가 axisVector→rule 로 계산하고 naming-lock 을 persist 하나, **렌더 0**.
근거: 소비처 = `/api/bty/archetype/route.ts` (DEAD, 아래 3) + `getMyPageIdentityState.ts:93` (결과 discard, post-#1).

### 3. /api/bty/archetype = Dead Transport = Intended
client fetch **0** (grep NONE). 미완성 wiring 아니라 **의도된 비노출**.
근거: #2 inventory — 어떤 .tsx/client 도 `bty/archetype` fetch 하지 않음.

### 4. Identity ≠ State (3층)
- **Identity = Code** — FORGE-series, single source `arena_profiles.code_index` (#1).
- **State = Pattern Signatures** — `user_pattern_signatures` (위 1).
- **Evidence = AIR / LRI / Leader Track** — 준비도·인증 상태형 (LRI raw 비노출) [my-page/leader/page.tsx:9].

### 5. Non-goal
**Archetype Rollup is NOT a missing feature. Its absence is intentional.**

---

## §2  TIME-SCOPED HONESTY

현재 구현 = 비표시(의도). Canon은 구현 위에 있으며, 미래 제품 결정이 표시를 택하면 **위반-B(어조: "당신은 X" 고정) 가드가 선결**. 이 문서는 "지금 안 만든 이유"의 기록 — 영구 금지 선언 아님.
