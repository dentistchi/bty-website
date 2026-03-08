# 엘리트 4차 — 특별 프로젝트(또는 해금 확장) 스펙 1페이지

**갱신일**: 2026-03-06  
**근거**: `ELITE_4TH_AND_NEXT_STEPS_SPEC.md` §2, `PHASE_4_ELITE_5_PERCENT_SPEC.md` §4-1·§4-3. 4차 후보 중 **1건** 선정 시 구현용 스펙.

---

## 1. 선정 옵션 요약

| 옵션 | 한 줄 | 구현 부담 |
|------|--------|-----------|
| **A. 특별 프로젝트** | Elite 전용 "이번 주 미션" 1종(예: 리플렉션 N회). 완료 시 보상(배지 또는 XP). | 중 — 미션 정의·진행 저장·보상 연동 |
| **B. 해금 확장** | 시나리오/에피소드에 `elite_only` 플래그. Elite일 때만 진입, 비Elite는 "상위 5% 달성 시" 문구. | 낮음 — 메타·unlock 체계 확장 |

**규칙**: Elite 판정 = 기존 GET `/api/me/elite`·`getIsEliteTop5`(주간 XP 상위 5%)만 사용. UI는 API 값만 렌더(render-only).

**구현 옵션 선정(1줄)**: **해금 확장(B)** 우선 — 구현 부담 낮음·기존 unlock 체계 연동. 특별 프로젝트(A)는 2차 후보.

---

## 2. 옵션 A — 특별 프로젝트 스펙

- **미션 정의**: 1종만. 예: "이번 주 리플렉션 3회 완료". 주간 리셋(weekly_xp 경계와 동일).
- **데이터**: 테이블 `elite_special_progress` (user_id, mission_key, period_start, count, completed_at) 또는 기존 이벤트/ledger 확장.
- **API**: GET `/api/me/elite` 또는 새 GET `/api/me/elite-special` → `{ missionKey, targetCount, currentCount, completed }`. 완료 시 보상(배지 또는 XP)은 기존 XP/배지 API 활용.
- **UI**: 대시보드 또는 `/bty/elite`에 "이번 주 특별 프로젝트" 블록. 진행률·완료 시 문구만 표시(계산 없음).

---

## 3. 옵션 B — 해금 확장 스펙

- **메타 확장**: 시나리오/에피소드 메타에 `elite_only: boolean` 또는 `elite_content_ids: string[]`. 기존 unlock 체계와 병행.
- **API**: 기존 시나리오/에피소드 목록 API에 `elite_only` 필드 포함. 진입 전 GET `/api/me/elite`로 Elite 여부 확인.
- **UI**: Elite 전용 콘텐츠 목록/진입 버튼은 Elite일 때만 노출. 비Elite 진입 시 "상위 5% 달성 시 이용 가능" 문구. `/bty/elite`·기존 Elite 전용 페이지와 정합성 유지.

---

## 4. 구현 시 공통 체크

- [ ] Elite 판정 로직 변경 없음 (주간 5%만 사용).
- [ ] UI는 API/도메인 값만 표시. XP·랭킹·시즌 계산 금지.
- [ ] `/bty/elite`, `/bty/dashboard`, 리더보드 기존 동작 회귀 없음.
- [ ] 구현 후 `ELITE_4TH_AND_NEXT_STEPS_SPEC.md` §3 검증 체크리스트 1회 실행·서류 반영.

---

*참고: `PHASE_4_ELITE_5_PERCENT_SPEC.md` §4-1·§4-3, `ELITE_4TH_AND_NEXT_STEPS_SPEC.md` §2·§3.*
