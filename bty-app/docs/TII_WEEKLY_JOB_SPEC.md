# TII Weekly Recomputation Job — 명세

**Phase**: P4 (Team Integrity Index)  
**근거**: `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §4 P4, `docs/LEADERSHIP_ENGINE_SPEC.md` §6.

---

## 목적

매 주 팀별 TII(Team Integrity Index)를 재계산하고, 불변 스냅샷 테이블(`TeamWeeklyMetrics` 등)에 저장한다.  
**팀 점수만 공개**하며, 개인 AIR는 절대 노출하지 않는다.

---

## 주간 재계산 Job 명세

### 트리거

- **주기**: 매주 1회 (예: 월요일 00:00 UTC 또는 시즌/리그의 `week_start` 기준).
- **실행 주체**: Cron, Vercel Cron, 또는 Supabase Edge Function 등 (Infrastructure 담당).
- **실제 배포**: GitHub Actions `tii-weekly-cron.yml` — 매주 월요일 00:00 UTC에 `POST /api/cron/tii-weekly` 호출.  
  - **필수 Secrets**: `DEPLOY_URL`(배포된 앱 URL, 예: `https://bty-website.xxx.workers.dev`), `CRON_SECRET`(동일 값을 앱 env `CRON_SECRET`에 설정).  
  - 배포 앱(Cloudflare Workers 등)에 `CRON_SECRET` 환경 변수 설정 필요.

### 입력 수집 (Infrastructure)

1. **팀 목록**: 저장소에서 모든 `team_id`(또는 `league_id` 등) 조회.
2. **팀별 입력** (해당 주 `week_start` 기준):
   - **Avg AIR**: 해당 팀 소속 유저들의 AIR_7d 평균. (AIR은 `src/domain/leadership-engine/air.ts` `computeAIR` / 활성화 로그로 계산.)
   - **Avg MWD**: 해당 팀 소속 유저들의 MWD_7d 평균. (MWD_7d = completed_verified_micro_wins / 7.)
   - **TSP**: 팀 Stability Pulse (당주 또는 롤링 평균, 1..5 스케일).

Infrastructure는 `GetTeamTIIInputs(teamId, weekStart)` 형태로 위 값을 반환하는 함수/쿼리를 구현한다.

### 재계산 단계

1. `week_start` = 해당 주의 시작일 (예: `"2026-03-10"`).
2. 각 `team_id`에 대해:
   - `getInputs(team_id, week_start)` 호출 → `TIIInputs` 획득.
   - `compute_team_tii(team_id, getInputs, week_start)` 호출 → `TIIResult` 획득.
3. 결과를 **불변** 스냅샷 테이블에 삽입 (예: `TeamWeeklyMetrics`: `team_id`, `week_start`, `tii`, `avg_air`, `avg_mwd`, `tsp`).  
   한 번 저장된 주간 행은 수정하지 않는다 (재계산 시 새 행 삽입 금지; upsert 시 `week_start`+`team_id` 유니크).

### 구현 경로

| 항목 | 경로 |
|------|------|
| 도메인 (순수 함수) | `src/domain/leadership-engine/tii.ts` — `computeTII`, `computeTIIWithComponents`, 정규화 함수 |
| 서비스 (team_id → 결과) | `src/lib/bty/leadership-engine/tii-service.ts` — `compute_team_tii(teamId, getInputs, weekStart?)` |
| 입력 제공 | Infrastructure: DB/API에서 팀별 AIR/MWD/TSP 집계 후 `GetTeamTIIInputs` 구현 |
| 스냅샷 저장 | Infrastructure: `TeamWeeklyMetrics` 스키마·마이그레이션, 삽입만 허용 (갱신 금지) |

### 제약

- **개인 AIR 미노출**: Job 내부에서 개인 AIR를 로그/응답에 남기지 않는다. 팀 집계(`avg_air`, `tii`)만 저장·공개.
- **결정론**: 동일 `week_start` + 동일 입력 → 동일 TII. 재실행 시 기존 스냅샷 행이 있으면 스킵하거나, idempotent insert (ON CONFLICT DO NOTHING) 사용.

---

## 참고

- **도메인 테스트**: `src/domain/leadership-engine/tii.test.ts` (15 cases).
- **서비스 테스트**: `src/lib/bty/leadership-engine/tii-service.test.ts` (3 cases).
