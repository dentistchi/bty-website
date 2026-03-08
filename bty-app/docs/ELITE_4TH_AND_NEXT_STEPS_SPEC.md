# 엘리트 4차 또는 다음 단계 스펙·체크리스트 (1페이지)

**갱신일**: 2026-03-06  
**근거**: `PHASE_4_ELITE_5_PERCENT_SPEC.md` §4·§7·§10, `PROJECT_PROGRESS_ORDER.md` §3. 3차(배지·멘토 대화 UI) 완료 후 **4차 후보**와 **다음 단계(로드맵)** 정리.

---

## 1. 엘리트 4차 후보 vs 다음 단계(로드맵)

| 구분 | 항목 | 한 줄 스펙 | 비고 |
|------|------|------------|------|
| **4차 후보** | 특별 프로젝트 | Elite 전용 "이번 주 미션"(예: 리플렉션 3회)·진행 추적·보상(배지/XP). §4-3. | 설계·테이블/이벤트 확장 필요 |
| **4차 후보** | 해금 콘텐츠 확장 | Elite 전용 시나리오/에피소드 1종 추가 또는 `elite_only` 플래그 확장. §4-1. | 기존 unlock 체계 연동 |
| **4차 후보** | 주간 vs 시즌 5% 정책 | `ELITE_5_PERCENT_POLICY.md` 정리·시즌 5% 혜택 여부. §6. | 정책 1페이지 후 구현 |
| **다음 단계** | 챗봇 훈련 심화 | RAG·구역별 예시 확장. 시스템 프롬프트·역할 정리. | ROADMAP 챗봇 시기 |
| **다음 단계** | Dojo·Dear Me 콘텐츠 심화 | 50문항·연습 플로우 2종·자존감 훈련 플로우 설계. | DOJO_DEAR_ME_NEXT_CONTENT 확장 |
| **다음 단계** | 접근성·단위 테스트·문서 | aria-label·포커스 1곳, 미커버 모듈 테스트, 백로그/Release Gate 점검. | 보드 NEXT_BACKLOG 반영 |

**우선순위 제안**: 4차는 "특별 프로젝트 1종" 또는 "해금 콘텐츠 1종 확장" 중 하나 선정 후 스펙 확정. 다음 단계는 보드·NEXT_PROJECT_RECOMMENDED와 동기화.

---

## 2. 4차 1건 선정 시 스펙 요약 (한 줄)

- **특별 프로젝트**: Elite만 노출되는 "이번 주 미션" 1종(예: 리플렉션 N회). 완료 시 보상(배지 또는 XP). 미션 정의·진행 상태 저장(테이블 또는 이벤트 확장). UI: 대시보드/Elite 페이지에 블록.
- **해금 콘텐츠 확장**: 시나리오/에피소드 메타에 `elite_only` 또는 `elite_content_ids` 추가. Elite일 때만 진입 가능, 비Elite는 "상위 5% 달성 시" 문구. 기존 `/bty/elite`·unlock 체계와 정합성 유지.

---

## 3. 검증 체크리스트 (4차 또는 다음 단계 구현 후 1회 실행)

| # | 항목 | 확인 방법 |
|---|------|------------|
| 1 | **Elite 판정 변경 없음** | GET `/api/me/elite`·`getIsEliteTop5`(주간 XP 상위 5%)만 사용. 시즌 5% 도입 시 별도 스펙 반영. |
| 2 | **UI render-only** | XP/랭킹/시즌 계산 없음. API·도메인 값만 렌더. bty-arena-global·bty-ui-render-only 준수. |
| 3 | **기존 경로 회귀 없음** | `/bty/elite`, `/bty/dashboard`, `/admin/mentor-requests`, 리더보드 정상 동작. |
| 4 | **문서 동기화** | PHASE_4_ELITE_5_PERCENT_SPEC §10 또는 NEXT_PROJECT_RECOMMENDED에 4차/다음 단계 반영. |

**PASS**: 해당 범위 모두 충족. **FAIL**: 불충족 항목 번호 + 현상 기록.

---

## 4. 검증 결과 (실행 후 기록)

| 항목 | 내용 |
|------|------|
| 검증 일시 | 2026-03-06 |
| 결과 | **PASS** |
| 비고 | ① GET /api/me/elite·getIsEliteTop5(주간 XP 상위 5%)만 사용 확인. ② UI render-only·bty-arena-global 준수. ③ /bty/elite·/bty/dashboard·/admin/mentor-requests·리더보드 경로 회귀 없음. ④ ELITE_4TH_AND_NEXT_STEPS_SPEC·NEXT_PROJECT_RECOMMENDED 4차/다음 단계 반영됨. |

---

*참고: `PHASE_4_ELITE_5_PERCENT_SPEC.md` §4·§7·§10, `ELITE_3RD_SPEC_AND_CHECKLIST.md`, `NEXT_PROJECT_RECOMMENDED.md`, `PROJECT_PROGRESS_ORDER.md` §3.*
