# Foundry 연간 로드맵

> 1페이지 요약. **갱신: 2026-03-09** (Q3 목표 1줄 갱신). 상세 스펙: `docs/spec/FOUNDRY_DOMAIN_SPEC.md`.

---

## 목적

- Foundry(기술·역량 훈련) 기능 개발 계획 정의
- Feature → Phase 순서로 우선순위 관리
- Arena(경쟁·XP)와 경계 유지 — 시나리오·LE·Elite는 공유 참조

---

## 시스템 범위

**Foundry** — Dojo(50문항 진단), Integrity(역지사지), Mentor(Dr. Chi), 시나리오 50개, Leadership Engine, Elite, Healing.

| 영역 | 경로 | 비고 |
|------|------|------|
| Domain | `src/domain/dojo/`, `src/domain/leadership-engine/`, `src/domain/foundry/` | 순수 규칙만 |
| Service | `src/lib/bty/scenario/`, `src/lib/bty/mentor/`, `src/lib/bty/foundry/` | 조립·DB 연동 |
| UI | `src/app/[locale]/bty/(protected)/` | render-only |

---

## Feature 우선순위 (개발 순서)

```text
1. Dojo (50문항 진단·제출·이력)
2. Integrity (역지사지 연습·Dr. Chi 피드백)
3. Mentor (Dr. Chi 대화·Safety Valve)
4. Scenario Engine (50개 시나리오·선택지·XP)
5. Leadership Engine (Stage·AIR·TII·LRI·Certified·Forced Reset)
6. Elite (배지·멘토 신청·특별 시나리오)
7. Healing / Awakening (phase 전환)
```

---

## 연도별 마일스톤 (요약)

| 시기 | 목표 | 완료 기준 |
|------|------|-----------|
| **2026 Q1** | Dojo·Integrity·Mentor·시나리오 50개 MVP | Dojo 제출/이력, Integrity 연습, Mentor 대화, 시나리오 목록·SCENARIOS_LIST |
| **2026 Q2** | 서비스 계층 정리·API 테스트·스펙 동기화 | dojoSubmitService·Integrity 서비스(선택)·dojo/submissions·mentor route 테스트, FOUNDRY↔ARENA 스펙 교차 참조 |
| **2026 Q3** | Leadership Engine·Elite 연동 강화 | LE Stage/AIR API 노출·Foundry 대시보드 표시, Elite 멘토 신청 목록·승인/거절 API·UI 완료 |
| **2026 Q4** | Healing·로드맵 갱신·다음 연도 백로그 | Awakening phase·연간 로드맵 2페이지(필요 시)·다음 연도 Feature 후보 정리 |

---

## 참조

- **진행률 요약**: `docs/FOUNDRY_PROGRESS.md` — 로드맵·Feature·스프린트 기준 완성도(%).
- **스펙 교차 참조**: 도메인 모듈·API 계약·비즈니스 규칙 상세는 `docs/spec/FOUNDRY_DOMAIN_SPEC.md` 참조.
- **도메인 스펙**: `docs/spec/FOUNDRY_DOMAIN_SPEC.md`
- **시나리오 목록**: `docs/specs/scenarios/SCENARIOS_LIST.md`
- **Arena 로드맵**: `docs/plans/ARENA_MASTER_PLAN.md`
- **시스템 경계**: `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md`
