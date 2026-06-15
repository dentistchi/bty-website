# INTEGRITY_EVIDENCE_INTENT

> Fact-fixing + 조건부 가드 (canon 신설 아님). **Time-scoped** — "현재 의도" 기록, "영구 금지" 선언 아님.
> 종속: `BTY_AVATAR_IDENTITY_LOCK.md` §2 (AIR/LRI = role-assignment only, 구축 단정 금지) 상속.
> Semantic scaffold = 측정 트랙. 의미 문장 = Commander.

---

## §0  PROVENANCE

- #3 Evidence surface 측정 (read-only) — live surfaces 위반 A/B/C/D = 전부 N(정합).
- #4 mount trace (read-only) — IntegrityScoreCardWidget reverse-unreachable 증명, LeadershipEngineWidget importer 0.
- 이 측정들이 아래 fact + 조건부 가드의 근거 — 측정이 후속 필요 여부 결정.

---

## §1  FIXED FACTS (5)

### 1. Evidence Layer (AIR / LRI / Leader) live surfaces = LOCK §2 UPHELD
- **AIR = band-only** (low/mid/high label; raw air 미표시) — [LeAirWidget.tsx:8,92] · [AIRTrendWidget.tsx:41] · [SessionSummaryOverlay.tsx:61] · [LeadershipStateRow.tsx:17].
- **LRI raw = admin-gated** (`lri.toFixed(2)` 는 admin/leadership-metrics 단독, `requireAdminEmail` [route.ts:77]). player live raw-LRI 노출 0.
- **Leader = role-assignment status** (Building / readiness / certification, static 라벨; LRI raw 비노출) — [my-page/leader/page.tsx:9,31,35,39].

### 2. Dead widgets = MOUNT 0 (증명)
- **IntegrityScoreCardWidget = MOUNT 0** — player route reverse-unreachable. 유일 importer = `WeeklyReportCard`, 그 자체 in-degree 0 (orphan); dynamic/lazy/barrel 재노출 0.
- **LeadershipEngineWidget = MOUNT 0** — importer 0.

### 3. Compute / Exists Only
두 위젯은 존재(코드)·계산만 — **현재 player-facing surface 0**.

### 4. 3층 경계 분리 유지
**Identity = Code** (FORGE, arena_profiles.code_index) / **State = Pattern Signatures** (user_pattern_signatures) / **Evidence = AIR · LRI · Leader**. live 렌더에서 혼입·중복불일치 0.

### 5. Non-goal
두 위젯의 player 비노출 = missing feature 아님. **현재 dead = 의도된 상태.**

---

## §2  CONDITIONAL GUARD (mount 선결 조건)

IntegrityScoreCard 표시 내용 — **grade letter (A–D)** + **composite delta (±N.N)** [IntegrityScoreCardWidget.tsx:179-210] — 은 AIR band/status 와 달리 **graded-score 형태**로 LOCK §2 "구축 단정" 경계에 근접한다.

→ **미래 어느 player route 에 mount 시, §2 role-assignment 어조 가드가 mount 의 선결 조건이다. band화 / disclosure-scope 없이 grade letter + delta 를 그대로 노출하지 않는다.**

---

## §3  TIME-SCOPED HONESTY

현재 dead = 의도된 비노출. 영구 금지 아님 — 재활성 시 §2 가드 선결. Canon은 구현 위에 있으며, 이 문서는 "지금 비노출인 이유 + 노출하려면 무엇이 선결인지"의 기록이다.
