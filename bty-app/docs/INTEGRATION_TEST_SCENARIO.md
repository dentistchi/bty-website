# 통합 시나리오 테스트 (NEXT_TASKS_2 §2-1)

**목적**: 로그인 → XP → 리더보드·프로필 흐름을 한 번에 검증.  
**실행**: 로컬(`npm run dev`) 또는 스테이징에서 아래 단계대로 진행.

---

## 1. 기본 시나리오: 로그인 → XP → 리더보드·프로필

| # | 단계 | 확인 내용 |
|---|------|-----------|
| 1 | **로그인** | `/ko/bty/login` 또는 `/en/bty/login`에서 로그인. 쿠키 발급 후 리다이렉트. |
| 2 | **대시보드** | `/[locale]/bty/dashboard` 진입. Core XP·주간 XP·멤버십·Arena Level 카드·아바타 노출. |
| 3 | **Arena 1회 진행** | `/[locale]/bty-arena` → 시나리오 선택 → 선택지 선택 → (선택) 리플렉션·Follow-up → 완료. Run 상태 DONE, `POST /api/arena/run/complete` 호출됨. |
| 4 | **XP 반영** | Run complete 시 `weekly_xp`(league_id null) 갱신, `applySeasonalXpToCore`로 Core XP 반영. 대시보드 새로고침 시 Core XP·주간 XP 증가 확인. |
| 5 | **리더보드** | `/[locale]/bty/leaderboard`에서 내 순위·주간 XP·챔피언(상위 3명) 노출. `nearMe`에 본인 포함. |
| 6 | **프로필·아바타** | 대시보드·리더보드에서 아바타(또는 이니셜)·코드명·서브명 표시. |

**코드 기준**: `run/complete` → weekly_xp upsert + `applySeasonalXpToCore` → arena_profiles.core_xp_total 갱신. 리더보드는 weekly_xp 정렬 + arena_profiles 조인.

---

## 2. 시나리오 노출 (Partner / Staff)

| # | 확인 내용 |
|---|-----------|
| 1 | **Staff** (예: doctor): `unlocked-scenarios` → track `staff`, levels S1~S3 (또는 tenure에 따라). |
| 2 | **Partner** (리더): track `leader`, levels S1~S3 + L1~L4(또는 tenure·l4_access에 따라). `docs/SCENARIO_UNLOCK_VERIFICATION.md` 참고. |

---

## 3. Elite (상위 5%)

| # | 확인 내용 |
|---|-----------|
| 1 | 주간 리더보드 상위 5%일 때 대시보드 **Elite 전용 콘텐츠** 카드 → `/[locale]/bty/elite` 링크 노출. |
| 2 | `/[locale]/bty/elite` 진입 시 Elite 문구·멘토 심화 링크. 비Elite 시 "상위 5% 달성 시 이용 가능" 메시지. |
| 3 | 멘토 페이지에서 Elite일 때 **Elite 멘토** 배지 노출. |

---

## 4. 이상 시 목록

테스트 중 발견한 이슈는 아래에 적어 두세요.

| 항목 | 설명 | 심각도 |
|------|------|--------|
| (없음) | — | — |

---

## 5. 실행 요약

- **환경**: 로컬 또는 스테이징.
- **필수**: 1절 기본 시나리오 1~6 단계 수행.
- **선택**: 2절(Partner/Staff), 3절(Elite) 계정으로 동일 시나리오 또는 levels·Elite 노출만 확인.

*작성: NEXT_TASKS_2 §2-1. 실행 후 이상 있으면 §4 표에 기입.*
