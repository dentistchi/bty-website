# 엘리트 3차 스펙·검증 체크리스트 (1페이지)

**갱신일**: 2026-03-06  
**근거**: `PHASE_4_ELITE_5_PERCENT_SPEC.md` §10. 3차 후보 2건(엘리트 배지 증정·멘토 대화 신청) 도메인·API 완료, **UI 마무리**용 스펙·검증 항목.

---

## 1. 스펙 요약

| 항목 | API·도메인 (완료) | UI 할 일 |
|------|-------------------|-----------|
| **엘리트 배지 증정** | `eliteBadge.getEliteBadgeGrants`, GET `/api/me/elite` 응답에 `badges` 반환 | Elite 페이지(`/bty/elite`)·대시보드에서 `badges` 배열 표시(아이콘·라벨). 비Elite는 기존 "상위 5% 달성 시 이용 가능" 유지. |
| **멘토 대화 신청** | `mentorRequest` 도메인, `elite_mentor_requests` 테이블. GET/POST `/api/me/mentor-request`, GET/PATCH `/api/arena/mentor-requests` | Elite 전용: 신청 폼·제출, 내 신청 목록(상태). 관리자: `/admin/mentor-requests` 기존 연동. UI는 API 응답만 표시(render-only). |

**규칙**: Elite 판정 = 기존 GET `/api/me/elite`·`getIsEliteTop5`(주간 XP 상위 5%)만 사용. UI는 XP/랭킹/시즌 계산 금지, API 값만 렌더.

---

## 2. 검증 체크리스트 (엘리트 3차 UI 완료 후 1회 실행)

| # | 항목 | 확인 방법 |
|---|------|------------|
| 1 | **배지 API 계약** | GET `/api/me/elite` 응답에 `badges` 배열 존재, Elite일 때만 비어 있지 않음. |
| 2 | **배지 UI 노출** | `/bty/elite`·대시보드 Elite 카드에서 `badges` 표시(아이콘 또는 라벨). 비Elite 시 배지 블록 비노출 또는 "상위 5% 달성 시" 문구만. |
| 3 | **멘토 신청 API** | POST `/api/me/mentor-request` (Elite만), GET `/api/me/mentor-request` 내 신청 목록. GET/PATCH `/api/arena/mentor-requests` 관리자용. |
| 4 | **멘토 신청 UI** | Elite일 때만 "멘토 대화 신청" CTA·폼 노출. 제출 후 목록/상태 표시. API 응답만 사용(계산 없음). |
| 5 | **규칙 준수** | XP/랭킹/시즌 계산 없음. 도메인·API 분리·bty-ui-render-only·bty-arena-global 준수. |
| 6 | **기존 경로 회귀 없음** | `/bty/elite`, `/bty/dashboard`, `/bty/mentor`, `/admin/mentor-requests` 정상 동작. |

**PASS**: 위 항목 해당 범위 모두 충족. **FAIL**: 불충족 항목 번호 + 현상 기록.

---

## 3. 검증 결과 (실행 후 기록)

| 항목 | 내용 |
|------|------|
| 검증 일시 | (C5 [VERIFY] 엘리트 3차 체크리스트 1회 실행 후 서류 반영 시 기입) |
| 결과 | — |
| 비고 | — |

---

*참고: `PHASE_4_ELITE_5_PERCENT_SPEC.md` §9·§10·§11, `NEXT_PROJECT_RECOMMENDED.md`.*
