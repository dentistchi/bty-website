# 엘리트 4차 해금 확장 — 구현 스펙 1페이지 (elite_only·API·UI)

**갱신일**: 2026-03-06  
**근거**: `ELITE_4TH_SPECIAL_OR_UNLOCK_1PAGE.md` §3 옵션 B, `PHASE_4_ELITE_5_PERCENT_SPEC.md` §4-1.  
**목적**: C3(API)·C4(UI) 구현 시 사용하는 단일 페이지 스펙. Elite 판정은 기존 `GET /api/me/elite`·`getIsEliteTop5`만 사용. UI는 API 값만 렌더(render-only).

---

## 1. 메타·데이터

- 시나리오/에피소드 메타에 **`elite_only: boolean`** 추가. 기존 unlock·레벨 체계와 병행.
- 예: Arena 시나리오 메타(`scenarios` 또는 코드/설정)에 `elite_only: true`인 항목을 Elite 전용으로 노출.

---

## 2. API 계약

| 항목 | 내용 |
|------|------|
| **목록 API** | 시나리오/에피소드 목록을 내려주는 기존 API에 **`elite_only: boolean`** 필드 포함. (필드 없으면 `false`.) |
| **Elite 여부** | 진입 전 클라이언트는 **GET `/api/me/elite`**로 `isElite` 확인. 기존 API 변경 없음. |
| **진입 제어** | 서버에서 Elite 전용 콘텐츠 접근 시 `isElite === false`면 403 또는 `{ allowed: false, message: "상위 5% 달성 시 이용 가능" }` 등으로 거절. (선택: 목록만 필터링해 비Elite에게 미노출도 가능.) |

---

## 3. UI 요구사항

| 상황 | 동작 |
|------|------|
| **Elite** | Elite 전용 콘텐츠 목록/진입 버튼 **노출**. 기존 `/bty/elite`·대시보드 Elite 카드와 정합성 유지. |
| **비Elite** | Elite 전용 진입 시도 시 **"상위 5% 달성 시 이용 가능"** 문구 표시. 리더보드/대시보드 링크 제공. |
| **계산 금지** | UI에서 XP·랭킹·시즌·Elite 판정 계산하지 않음. `GET /api/me/elite`·목록 API 응답만 사용. |

---

## 4. 구현 체크리스트

- [ ] 시나리오/에피소드 메타에 `elite_only` 반영(도메인·목록 API).
- [ ] 목록 API 응답에 `elite_only` 필드 포함.
- [ ] Elite 전용 진입 시 서버에서 `isElite` 검사(또는 목록 필터링).
- [ ] UI: Elite일 때만 진입 가능. 비Elite 시 "상위 5% 달성 시 이용 가능" 문구.
- [ ] `/bty/elite`, `/bty/dashboard`, 리더보드 기존 동작 회귀 없음.
- [ ] 구현 후 `ELITE_4TH_AND_NEXT_STEPS_SPEC.md` §3 검증 1회·서류 반영.

---

*참고: `ELITE_4TH_SPECIAL_OR_UNLOCK_1PAGE.md` §3·§4, `PHASE_4_ELITE_5_PERCENT_SPEC.md` §4-1.*
