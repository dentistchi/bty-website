# Season XP vs Core XP

## Season XP (Competition XP)

- **의미:** 시즌/기간 단위 경쟁용 XP. 리더보드·레벨·티어에 사용.
- **출처:** `weekly_xp` (시즌 구간 합산).
- **특징:** 기간이 있음 (예: 2026-01-25 → 2026-02-24). 이벤트 참여 횟수와 구간 합산으로 산출.
- **UI:** Level, Tier(Bronze/Silver/Gold/Platinum), Progress %.

## Core XP

- **의미:** 장기 누적 XP. 시즌과 무관하게 계속 쌓임.
- **출처:** `arena_profiles.core_xp_total`.
- **특징:** Stage 단위(100 XP당 1 Stage), Code Name 연동. 700+ 구간에서는 Code Name 숨김·잠금.
- **UI:** Stage N, Progress 0/100, Code Name.

요약: **Season XP = 시즌 경쟁용**, **Core XP = 장기 성장용**.
