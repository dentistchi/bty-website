# LRI / Certified Admin Surface — DESIGN V1

상태: LOCKED 2026-05-31 (Commander). 구현 단일 기준. 실행자 = Claude Code.
Lane: LRI/Certified를 admin leadership-metrics(AIR 탭)에 surface. Cohort = leader.
file:line 근거 = STEP 0 READ-ONLY 진단 회수분.

## 0. Commander Decisions (verbatim)

### 0.1 P-A pulse
Commander Decision — P-A.
Implement personal_responsibility_pulse as a session/action-loop terminal self-rating.
Question: "이번 상황에서 나는 책임을 회피하지 않고 감당하려고 했는가?"
Scale: 1–5.
Aggregation: 14-day rolling average normalized to 0–1.
LRI: 0.50 * AIR_14d + 0.30 * MWD_norm + 0.20 * pulse_norm.
Launch: If no pulse exists, LRI = null/pending. Do not backfill, fake, default to 0, or collapse to 2-term LRI.

### 0.2 DESIGN approval
Commander Lock — LRI/Certified admin surface DESIGN approved.
Scope: P-A pulse capture, le_pulse_log single migration, buildCertifiedInputs, buildLRIInputs,
admin leadership metrics route extension, AIR tab LRI + Certified columns,
no fake pulse, no 2-term LRI, LRI pending until real pulse exists.
Mutation rule: DB migration approved as design scope, production application gated until explicit Commander migration dispatch.

## 1. Canonical lock
- LRI getLRI = B: src/lib/bty/leadership-engine/certified-lri-service.ts:56 (pure orchestrator -> src/domain/leadership-engine/lri.ts computeLRI).
- A: lri-calculator.service.ts:214 = 별지표(AIR-trend promotion_ready), leadership_readiness_index reader(빈 테이블) -> 격리 백로그, 이번 lane 미터치.
- Certified = getCertifiedStatus(userId, getInputs) 기존 + concrete getInputs 신규.
- foundry barrel(foundry/index.ts:62) re-export = B. A 미호출 유지.

## 2. pulse 도메인 (신규)
DB: le_pulse_log (migration §7). naming = le_activation_log/le_verification_log 계열.
domain: src/domain/leadership-engine/pulse.ts
  - normalizePulse = 기존 normalizePersonalPulse(lri.ts:37, (clamp(1..5)-1)/4) 재사용.
  - computePulse14d(records, asOf) -> { pulseNorm, hasPulse }. 14d raw 평균 후 정규화. hasPulse=false -> LRI pending 신호.
  - test: pulse.test.ts.
capture: 행동 루프 종단(7-step Step6 AD2 / Step7 behavior-change-validation 완료 핸들러)에 1문항.
  종단 핸들러 file:line = 구현 3단계 grep 확정(추정 금지). 계약: 세션/시나리오 종료 1회, 다중 캡처 허용(rolling 흡수).
API: POST /api/arena/pulse (authed) body { pulse_value:1..5, session_id? } -> le_pulse_log insert.
  정확 route group = 기존 arena API 패턴 맞춰 3단계 확정.

## 3. input-assembly (신규 concrete)
buildCertifiedInputs(supabase, userId): CertifiedInputs  (lib/bty/leadership-engine/)
  - air14d: computeAIR(activations,"14d"), le_activation_log 14d fetch. admin lifetime 계산 재사용 불가.
  - mwd14d: mwd/route.ts:62 로직 + normalizeMWD. 재사용.
  - resetComplianceMet: 신규 90d lookback (§4). arena route 하드코딩 false 대체.
  - noIntegritySlipIn14d: detectIntegritySlip(activations,"14d"), integrity_slip_log + detectIntegritySlip(air.ts:198). 기존 7d -> 14d param.
buildLRIInputs(supabase, userId): LRIInputs | { pending:true }
  - air14d(§ 공유) + mwd_norm(§ 공유) + pulse_norm(computePulse14d).
  - hasPulse=false -> { pending:true } 반환, computeLRI 미호출(2항 붕괴 금지, §0).

## 4. resetComplianceMet (lock)
spec §7A. 결정:
  90d 내 forced_reset_triggered_at 0건 -> true (vacuous, 의무 없음)
  90d 내 reset 완료(type=reset, completed <= trigger+48h) >=1 -> true
  90d 내 reset >=2 -> true
  그 외 -> false
trigger<->completion 링크 소스 = 구현 4단계 residency 확정.

## 5. route 확장 (신규 route 아님)
admin/leadership-metrics/route.ts:108-161 per-user 루프 합류. UserAirRow 확장:
  + certified: boolean
  + certifiedReasonsMissing: string[]
  + lri: number | null
  + lriPending: boolean
per-user: buildCertifiedInputs->getCertifiedStatus, buildLRIInputs->(pending? null : getLRI B). A 미호출.
20명 x query 허용. listUsers 1000 cap 무관.

## 6. UI — AIR 탭 컬럼 2개
- LRI: 0.00-1.00 또는 pending(pulse 14d 0건). admin surface 허용(requireAdminEmail), end-user 비공개 유지.
- Certified: 배지(Certified/Not yet) + reasonsMissing tooltip.
- i18n: 신규 키 전 residency grep 필수. M-4가 Stage legend에 Certified/LRI/Forced Reset를 leadershipMetricsAdmin ns 추가 -> 충돌/재사용 확인 후 신설.

## 7. migration plan (DB mutation, Commander 승인 게이트)
신규 = le_pulse_log 1개. AIR/MWD/reset/slip 전부 기존 테이블 read -> migration 불요.
단일 Supabase = prod-effective. Commander 직접 적용. migration always before worker code.

## 8. D-0 behavior (정직, §0 준수)
fresh 20 leader: pulse 14d 0건 -> 전원 lriPending=true, LRI=null. AIR 14d 미누적 -> certified=false + reasonsMissing.
backfill/fake 없음. 14d 경과+pulse 누적되며 채워짐.
computeAIR/computePulse14d 빈입력 반환(0 vs NaN) = build 실측.

## 9. 단계 시퀀스 (각 inner+outer 쌍 commit, verify 분리)
1. migration le_pulse_log -- Commander 승인+직접 적용 (DB gate)
2. pulse.ts domain + test -> verify (tsc + vitest)
3. pulse POST API + capture wiring(종단 핸들러 grep 선행) -> verify
4. buildCertifiedInputs + buildLRIInputs + test -> verify
5. route 확장(UserAirRow + 루프) -> verify
6. UI 컬럼 2 + i18n(residency 선행) -> verify
7. redeploy (Infra Mode, Commander gate) -> 3-way verify + 브라우저 실측
verify gate = tsc --noEmit + terminology(=13 무회귀), exit code 직후 캡처.

## 10. 격리 (이번 lane 미터치)
A getLRI + recomputeAndPersistLRI(lri-calculator.service.ts:144, caller 0) + leadership_readiness_index(빈+cron 부재) -> 제거 검토 백로그.
cron 부재로 Certified 분기 재평가 자동화 없음 -> 동일 백로그(D-0 수동 OK).
