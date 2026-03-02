# 시나리오 마이그레이션·Stage4 호환 로그

**목적**: bty_scenario_v1 시나리오 추가/변경 이력 및 Stage4 호환(supports_reset, Reset/48h/검증) 체크 기록.

**참조**: `docs/LEADERSHIP_ENGINE_SPEC.md` §5 Reset, `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §4 P3 Scenario Cursor, `docs/specs/bty-scenario-schema-v1.json`, `docs/ENGINE_SCENARIO_FIT_AND_ROLES.md`, `docs/specs/scenarios/SCN_WA_0001.json`(참조 형식).

---

## 1. 시나리오 파일 경로

| 경로 | scenario_id | 추가/수정 일자 | 비고 |
|------|--------------|----------------|------|
| `docs/specs/scenarios/SCN_WA_0001.json` | SCN_WA_0001 | (기존) | Handoff Breakdown. P3에서 `supports_reset` 명시 추가. |
| `docs/specs/scenarios/SCN_RESET_0001.json` | SCN_RESET_0001 | 2026-03 | Stage4 전용 Integrity Reset 시나리오. Reset 템플릿·48h·검증 경로 포함. |
| `docs/specs/scenarios/SCN_PT_0001.json` | SCN_PT_0001 | 2026-03 | 기존 `patient_refuses_treatment_001` → bty_scenario_v1 이전 1건. |
| `docs/specs/scenarios/SCN_FD_0002.json` | SCN_FD_0002 | 2026-03 | front_desk_overbook_002 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_HQ_0003.json` | SCN_HQ_0003 | 2026-03 | hygienist_questions_diagnosis_003 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_MP_0004.json` | SCN_MP_0004 | 2026-03 | manager_production_vs_clinical_004 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_AS_0005.json` | SCN_AS_0005 | 2026-03 | assistant_sterilization_errors_005 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PNR_0006.json` | SCN_PNR_0006 | 2026-03 | patient_negative_review_006 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_DC_0007.json` | SCN_DC_0007 | 2026-03 | doctor_chronic_late_007 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_DE_0008.json` | SCN_DE_0008 | 2026-03 | dso_ebitda_pressure_008 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PO_0009.json` | SCN_PO_0009 | 2026-03 | patient_overtreatment_accusation_009 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_HB_0010.json` | SCN_HB_0010 | 2026-03 | hygienist_burnout_010 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_ID_0011.json` | SCN_ID_0011 | 2026-03 | insurance_denial_patient_conflict_011 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_AG_0012.json` | SCN_AG_0012 | 2026-03 | assistant_gossips_about_doctor_012 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_DD_0013.json` | SCN_DD_0013 | 2026-03 | doctor_disagrees_dso_protocol_013 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PA_0014.json` | SCN_PA_0014 | 2026-03 | patient_requests_unnecessary_antibiotics_014 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_NA_0015.json` | SCN_NA_0015 | 2026-03 | new_associate_underperforms_015 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_HI_0016.json` | SCN_HI_0016 | 2026-03 | hipaa_breach_incident_016 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_HP_0017.json` | SCN_HP_0017 | 2026-03 | hygienist_demands_pay_raise_017 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_DA_0018.json` | SCN_DA_0018 | 2026-03 | doctor_anger_in_operatory_018 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PC_0019.json` | SCN_PC_0019 | 2026-03 | patient_cannot_afford_treatment_019 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_OC_0020.json` | SCN_OC_0020 | 2026-03 | office_culture_divided_020 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PQ_0021.json` | SCN_PQ_0021 | 2026-03 | patient_questions_treatment_plan_021 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_AM_0022.json` | SCN_AM_0022 | 2026-03 | assistant_mistake_during_procedure_022 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PL_0023.json` | SCN_PL_0023 | 2026-03 | patient_late_blames_office_023 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_TM_0024.json` | SCN_TM_0024 | 2026-03 | team_member_interrupts_024 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_IC_0025.json` | SCN_IC_0025 | 2026-03 | insurance_coordinator_billing_error_025 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PX_0026.json` | SCN_PX_0026 | 2026-03 | patient_refuses_xrays_026 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_NE_0027.json` | SCN_NE_0027 | 2026-03 | new_employee_overwhelmed_027 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PP_0028.json` | SCN_PP_0028 | 2026-03 | patient_complains_pain_after_028 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_SL_0029.json` | SCN_SL_0029 | 2026-03 | staff_arrives_late_repeatedly_029 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_DP_0030.json` | SCN_DP_0030 | 2026-03 | doctor_production_pressure_030 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_TU_0031.json` | SCN_TU_0031 | 2026-03 | team_member_feels_unappreciated_031 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PF_0032.json` | SCN_PF_0032 | 2026-03 | patient_challenges_fee_032 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_SR_0033.json` | SCN_SR_0033 | 2026-03 | senior_staff_resists_new_protocol_033 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_RV_0034.json` | SCN_RV_0034 | 2026-03 | patient_leaves_negative_review_034 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_YC_0035.json` | SCN_YC_0035 | 2026-03 | you_feel_compared_to_another_doctor_035 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_AO_0036.json` | SCN_AO_0036 | 2026-03 | assistant_feels_over_corrected_036 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_RF_0037.json` | SCN_RF_0037 | 2026-03 | patient_requests_refund_037 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_MO_0038.json` | SCN_MO_0038 | 2026-03 | manager_feels_overloaded_038 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_DR_0039.json` | SCN_DR_0039 | 2026-03 | dso_requests_cost_reduction_039 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PCL_0040.json` | SCN_PCL_0040 | 2026-03 | patient_cancels_last_minute_040 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_TC_0041.json` | SCN_TC_0041 | 2026-03 | team_conflict_between_staff_041 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PI_0042.json` | SCN_PI_0042 | 2026-03 | patient_questions_infection_control_042 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_AD_0043.json` | SCN_AD_0043 | 2026-03 | associate_disagrees_in_meeting_043 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_PDI_0044.json` | SCN_PDI_0044 | 2026-03 | patient_demands_immediate_attention_044 → bty_scenario_v1 이전. |
| `docs/specs/scenarios/SCN_YR_0045.json` | SCN_YR_0045 | 2026-03 | you_realize_overreacted_045 → bty_scenario_v1 이전. |

---

## 2. 기존 시나리오( scenarios.ts ) → bty_scenario_v1 이전

**기준**: `docs/ENGINE_SCENARIO_FIT_AND_ROLES.md`, `docs/specs/scenarios/SCN_WA_0001.json` 형식.  
**소스**: `src/lib/bty/scenario/scenarios.ts` 내 `SCENARIOS[]`.  
이전 시 **필수**: `schema_version`, `context_type`, `choices[].engine_signals`, `choices[].activation_plan`, `metrics_hooks`, `delayed_outcome` 포함.

| 순서 | 소스 scenarioId | 이전 후 scenario_id | 파일 경로 | 이전 일자 | 비고 |
|------|------------------|----------------------|-----------|-----------|------|
| 1 | patient_refuses_treatment_001 | SCN_PT_0001 | `docs/specs/scenarios/SCN_PT_0001.json` | 2026-03 | A=direct_fix, B=process_fix, C=delegate_with_checkpoint, D=withdraw. |
| 2 | front_desk_overbook_002 | SCN_FD_0002 | `docs/specs/scenarios/SCN_FD_0002.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=delegate_with_checkpoint, D=withdraw. |
| 3 | hygienist_questions_diagnosis_003 | SCN_HQ_0003 | `docs/specs/scenarios/SCN_HQ_0003.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=delegate_with_checkpoint, D=withdraw. |
| 4 | manager_production_vs_clinical_004 | SCN_MP_0004 | `docs/specs/scenarios/SCN_MP_0004.json` | 2026-03 | A=direct_fix, B=process_fix, C=cynicism, D=withdraw. |
| 5 | assistant_sterilization_errors_005 | SCN_AS_0005 | `docs/specs/scenarios/SCN_AS_0005.json` | 2026-03 | A=direct_fix, B=process_fix, C=delegate_with_checkpoint, D=withdraw. |
| 6 | patient_negative_review_006 | SCN_PNR_0006 | `docs/specs/scenarios/SCN_PNR_0006.json` | 2026-03 | A=process_fix, B=delegate_with_checkpoint, C/D=withdraw. |
| 7 | doctor_chronic_late_007 | SCN_DC_0007 | `docs/specs/scenarios/SCN_DC_0007.json` | 2026-03 | A=process_fix, B=direct_fix(speed_bias), C/D=withdraw. |
| 8 | dso_ebitda_pressure_008 | SCN_DE_0008 | `docs/specs/scenarios/SCN_DE_0008.json` | 2026-03 | A=process_fix, B=delegate_with_checkpoint, C=direct_fix, D=withdraw. |
| 9 | patient_overtreatment_accusation_009 | SCN_PO_0009 | `docs/specs/scenarios/SCN_PO_0009.json` | 2026-03 | A=delegate_with_checkpoint, B=direct_fix(speed_bias), C/D=withdraw. |
| 10 | hygienist_burnout_010 | SCN_HB_0010 | `docs/specs/scenarios/SCN_HB_0010.json` | 2026-03 | A=delegate_with_checkpoint, B=direct_fix(speed_bias), C=process_fix, D=withdraw. |
| 11 | insurance_denial_patient_conflict_011 | SCN_ID_0011 | `docs/specs/scenarios/SCN_ID_0011.json` | 2026-03 | A=withdraw, B=process_fix, C=delegate_with_checkpoint, D=withdraw. |
| 12 | assistant_gossips_about_doctor_012 | SCN_AG_0012 | `docs/specs/scenarios/SCN_AG_0012.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 13 | doctor_disagrees_dso_protocol_013 | SCN_DD_0013 | `docs/specs/scenarios/SCN_DD_0013.json` | 2026-03 | A=cynicism, B=process_fix, C=delegate_with_checkpoint, D=withdraw. |
| 14 | patient_requests_unnecessary_antibiotics_014 | SCN_PA_0014 | `docs/specs/scenarios/SCN_PA_0014.json` | 2026-03 | A=cynicism, B=direct_fix, C/D=withdraw. |
| 15 | new_associate_underperforms_015 | SCN_NA_0015 | `docs/specs/scenarios/SCN_NA_0015.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 16 | hipaa_breach_incident_016 | SCN_HI_0016 | `docs/specs/scenarios/SCN_HI_0016.json` | 2026-03 | A/C=withdraw, B=process_fix, D=direct_fix(speed_bias). |
| 17 | hygienist_demands_pay_raise_017 | SCN_HP_0017 | `docs/specs/scenarios/SCN_HP_0017.json` | 2026-03 | A=delegate_with_checkpoint, B=process_fix, C/D=withdraw. |
| 18 | doctor_anger_in_operatory_018 | SCN_DA_0018 | `docs/specs/scenarios/SCN_DA_0018.json` | 2026-03 | A=withdraw, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 19 | patient_cannot_afford_treatment_019 | SCN_PC_0019 | `docs/specs/scenarios/SCN_PC_0019.json` | 2026-03 | A=delegate_with_checkpoint, B=process_fix, C/D=withdraw. |
| 20 | office_culture_divided_020 | SCN_OC_0020 | `docs/specs/scenarios/SCN_OC_0020.json` | 2026-03 | A=withdraw, B=process_fix, C/D=withdraw. |
| 21 | patient_questions_treatment_plan_021 | SCN_PQ_0021 | `docs/specs/scenarios/SCN_PQ_0021.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 22 | assistant_mistake_during_procedure_022 | SCN_AM_0022 | `docs/specs/scenarios/SCN_AM_0022.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 23 | patient_late_blames_office_023 | SCN_PL_0023 | `docs/specs/scenarios/SCN_PL_0023.json` | 2026-03 | A=process_fix, B=delegate_with_checkpoint, C/D=withdraw. |
| 24 | team_member_interrupts_024 | SCN_TM_0024 | `docs/specs/scenarios/SCN_TM_0024.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 25 | insurance_coordinator_billing_error_025 | SCN_IC_0025 | `docs/specs/scenarios/SCN_IC_0025.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 26 | patient_refuses_xrays_026 | SCN_PX_0026 | `docs/specs/scenarios/SCN_PX_0026.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=delegate_with_checkpoint, D=cynicism. |
| 27 | new_employee_overwhelmed_027 | SCN_NE_0027 | `docs/specs/scenarios/SCN_NE_0027.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 28 | patient_complains_pain_after_028 | SCN_PP_0028 | `docs/specs/scenarios/SCN_PP_0028.json` | 2026-03 | A/B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 29 | staff_arrives_late_repeatedly_029 | SCN_SL_0029 | `docs/specs/scenarios/SCN_SL_0029.json` | 2026-03 | A=direct_fix, B=process_fix, C/D=withdraw. |
| 30 | doctor_production_pressure_030 | SCN_DP_0030 | `docs/specs/scenarios/SCN_DP_0030.json` | 2026-03 | A=cynicism, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 31 | team_member_feels_unappreciated_031 | SCN_TU_0031 | `docs/specs/scenarios/SCN_TU_0031.json` | 2026-03 | A=withdraw, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 32 | patient_challenges_fee_032 | SCN_PF_0032 | `docs/specs/scenarios/SCN_PF_0032.json` | 2026-03 | A=delegate_with_checkpoint, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 33 | senior_staff_resists_new_protocol_033 | SCN_SR_0033 | `docs/specs/scenarios/SCN_SR_0033.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 34 | patient_leaves_negative_review_034 | SCN_RV_0034 | `docs/specs/scenarios/SCN_RV_0034.json` | 2026-03 | A=withdraw, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 35 | you_feel_compared_to_another_doctor_035 | SCN_YC_0035 | `docs/specs/scenarios/SCN_YC_0035.json` | 2026-03 | A=withdraw, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 36 | assistant_feels_over_corrected_036 | SCN_AO_0036 | `docs/specs/scenarios/SCN_AO_0036.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 37 | patient_requests_refund_037 | SCN_RF_0037 | `docs/specs/scenarios/SCN_RF_0037.json` | 2026-03 | A=withdraw, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 38 | manager_feels_overloaded_038 | SCN_MO_0038 | `docs/specs/scenarios/SCN_MO_0038.json` | 2026-03 | A=direct_fix(speed_bias), B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 39 | dso_requests_cost_reduction_039 | SCN_DR_0039 | `docs/specs/scenarios/SCN_DR_0039.json` | 2026-03 | A=withdraw, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 40 | patient_cancels_last_minute_040 | SCN_PCL_0040 | `docs/specs/scenarios/SCN_PCL_0040.json` | 2026-03 | A/B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 41 | team_conflict_between_staff_041 | SCN_TC_0041 | `docs/specs/scenarios/SCN_TC_0041.json` | 2026-03 | A=withdraw, B=process_fix, C=direct_fix(speed_bias), D=delegate_with_checkpoint. |
| 42 | patient_questions_infection_control_042 | SCN_PI_0042 | `docs/specs/scenarios/SCN_PI_0042.json` | 2026-03 | A=withdraw, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 43 | associate_disagrees_in_meeting_043 | SCN_AD_0043 | `docs/specs/scenarios/SCN_AD_0043.json` | 2026-03 | A=withdraw, B=process_fix, C/D=delegate_with_checkpoint. |
| 44 | patient_demands_immediate_attention_044 | SCN_PDI_0044 | `docs/specs/scenarios/SCN_PDI_0044.json` | 2026-03 | A=withdraw, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |
| 45 | you_realize_overreacted_045 | SCN_YR_0045 | `docs/specs/scenarios/SCN_YR_0045.json` | 2026-03 | A=withdraw, B=process_fix, C=withdraw, D=delegate_with_checkpoint. |

*(이후 시나리오는 아래 §2-1 방법대로 한 건씩 이전하고, 이 표에 한 줄씩 추가.)*

**이전 완료**: scenarios.ts 소스 시나리오 001~045 전체 45건 이전 완료. (patient_refuses_treatment_001 → SCN_PT_0001 … you_realize_overreacted_045 → SCN_YR_0045)

---

## 2-1. 이후 시나리오 이전 방법

**한 건 이전 시 순서**

| 단계 | 할 일 |
|------|--------|
| 1 | SCN_WA_0001 / SCN_PT_0001 구조를 참고해 새 JSON 작성 |
| 2 | `docs/specs/scenarios/SCN_<prefix>_<NNNN>.json` 경로로 저장 |
| 3 | §2 표에 한 줄 추가: 순서, 소스 scenarioId, 이전 후 scenario_id, 파일 경로, 이전 일자, 비고(choice_type 매핑 등) |
| 4 | §1 시나리오 파일 경로 표에 해당 파일 행 추가 |
| 5 | 필요 시 §5 변경 이력에 "OOO → SCN_XXX_NNNN 이전" 한 줄 추가 |

**참고**: ENGINE_SCENARIO_FIT_AND_ROLES·SCN_WA_0001 기준으로 한 건씩 이전하면서 이 로그에만 기록하면 됩니다.

**남은 시나리오 소스**: `src/lib/bty/scenario/scenarios.ts` 내 `SCENARIOS[]` (front_desk_overbook_002 ~ you_realize_overreacted_045 등).

---

## 3. Stage4 호환 체크 (supports_reset: true 인 시나리오)

Stage4 호환 시나리오는 다음 세 가지를 **모두** 만족해야 함.

- **Reset activation template**: 최소 1개 choice에 `activation_plan.type === "reset"`, `weight === 2`.
- **48-hour due window**: 해당 choice의 `activation_plan.window_hours === 48`.
- **Verification path**: 해당 choice에 `activation_plan.verification` 존재, `method`(예: `"qr"`), `verifier_role` 명시.

| scenario_id | supports_reset | Reset 템플릿 | 48h 창 | 검증 경로 | 체크 일자 |
|-------------|----------------|--------------|--------|-----------|-----------|
| SCN_WA_0001 | false | — | — | 모든 choice에 verification 있음 (24h) | 2026-03 |
| SCN_PT_0001 | false | — | — | 모든 choice에 verification 있음 (24h) | 2026-03 |
| SCN_RESET_0001 | **true** | ✅ (choice RESET, type reset, weight 2) | ✅ (window_hours 48) | ✅ (method qr, verifier_role Manager) | 2026-03 |

---

## 4. 스키마·규칙 요약

- **supports_reset**: 시나리오 루트 필드. `true`이면 해당 시나리오가 Stage4(Integrity Reset) 플로우에서 사용 가능하며, 위 3요소(Reset 템플릿, 48h, 검증)를 만족해야 함.
- **activation_plan.type** `"reset"`: 엔진에서 AIR 가중치 2.0, Reset 완료 시 Stage 4→1 전이에 사용.
- **window_hours 48**: Reset 강제 조건과 동일. 사용자 최대 48시간 지연만 허용.

---

## 5. 변경 이력

| 일자 | 변경 내용 |
|------|-----------|
| 2026-03 | P3 Scenario Cursor 완료. SCN_RESET_0001 추가. SCN_WA_0001에 `supports_reset: false` 명시. 본 로그 문서 생성. |
| 2026-03 | 기존 시나리오 bty_scenario_v1 이전 시작. `patient_refuses_treatment_001` → SCN_PT_0001.json 생성. §1 시나리오 파일 경로·§2 이전 표·참조에 ENGINE_SCENARIO_FIT_AND_ROLES·SCN_WA_0001 반영. |
| 2026-03 | §2-1 이후 시나리오 이전 방법 추가. 순서(참조 JSON 작성 → 저장 경로 → §2·§1·§5 갱신)·남은 scenarioId 목록 참고용 기재. |
| 2026-03 | §2-1 한 건 이전 시 순서를 단계·할 일 표(5단계)로 정리, 참고(ENGINE_SCENARIO_FIT_AND_ROLES·이 로그에만 기록) 반영. |
| 2026-03 | front_desk_overbook_002 → SCN_FD_0002 이전. |
| 2026-03 | hygienist_questions_diagnosis_003 → SCN_HQ_0003 이전. |
| 2026-03 | manager_production_vs_clinical_004 → SCN_MP_0004 이전. |
| 2026-03 | assistant_sterilization_errors_005 → SCN_AS_0005 이전. |
| 2026-03 | patient_negative_review_006 → SCN_PNR_0006 이전. |
| 2026-03 | doctor_chronic_late_007 → SCN_DC_0007 이전. |
| 2026-03 | dso_ebitda_pressure_008 → SCN_DE_0008 이전. |
| 2026-03 | patient_overtreatment_accusation_009 → SCN_PO_0009 이전. |
| 2026-03 | hygienist_burnout_010 → SCN_HB_0010 이전. |
| 2026-03 | insurance_denial_patient_conflict_011 → SCN_ID_0011 이전. |
| 2026-03 | assistant_gossips_about_doctor_012 → SCN_AG_0012 이전. |
| 2026-03 | doctor_disagrees_dso_protocol_013 → SCN_DD_0013 이전. |
| 2026-03 | patient_requests_unnecessary_antibiotics_014 → SCN_PA_0014 이전. |
| 2026-03 | new_associate_underperforms_015 → SCN_NA_0015 이전. |
| 2026-03 | hipaa_breach_incident_016 → SCN_HI_0016 이전. |
| 2026-03 | hygienist_demands_pay_raise_017 → SCN_HP_0017 이전. |
| 2026-03 | doctor_anger_in_operatory_018 → SCN_DA_0018 이전. |
| 2026-03 | patient_cannot_afford_treatment_019 → SCN_PC_0019 이전. |
| 2026-03 | office_culture_divided_020 → SCN_OC_0020 이전. |
| 2026-03 | patient_questions_treatment_plan_021 → SCN_PQ_0021 이전. |
| 2026-03 | assistant_mistake_during_procedure_022 → SCN_AM_0022 이전. |
| 2026-03 | patient_late_blames_office_023 → SCN_PL_0023 이전. |
| 2026-03 | team_member_interrupts_024 → SCN_TM_0024 이전. |
| 2026-03 | insurance_coordinator_billing_error_025 → SCN_IC_0025 이전. |
| 2026-03 | patient_refuses_xrays_026 → SCN_PX_0026 이전. |
| 2026-03 | new_employee_overwhelmed_027 → SCN_NE_0027 이전. |
| 2026-03 | patient_complains_pain_after_028 → SCN_PP_0028 이전. |
| 2026-03 | staff_arrives_late_repeatedly_029 → SCN_SL_0029 이전. |
| 2026-03 | doctor_production_pressure_030 → SCN_DP_0030 이전. |
| 2026-03 | team_member_feels_unappreciated_031 → SCN_TU_0031 이전. |
| 2026-03 | patient_challenges_fee_032 → SCN_PF_0032 이전. |
| 2026-03 | senior_staff_resists_new_protocol_033 → SCN_SR_0033 이전. |
| 2026-03 | patient_leaves_negative_review_034 → SCN_RV_0034 이전. |
| 2026-03 | you_feel_compared_to_another_doctor_035 → SCN_YC_0035 이전. |
| 2026-03 | assistant_feels_over_corrected_036 → SCN_AO_0036 이전. |
| 2026-03 | patient_requests_refund_037 → SCN_RF_0037 이전. |
| 2026-03 | manager_feels_overloaded_038 → SCN_MO_0038 이전. |
| 2026-03 | dso_requests_cost_reduction_039 → SCN_DR_0039 이전. |
| 2026-03 | patient_cancels_last_minute_040 → SCN_PCL_0040 이전. |
| 2026-03 | team_conflict_between_staff_041 → SCN_TC_0041 이전. |
| 2026-03 | patient_questions_infection_control_042 → SCN_PI_0042 이전. |
| 2026-03 | associate_disagrees_in_meeting_043 → SCN_AD_0043 이전. |
| 2026-03 | patient_demands_immediate_attention_044 → SCN_PDI_0044 이전. |
| 2026-03 | you_realize_overreacted_045 → SCN_YR_0045 이전. §2 scenarios.ts 001~045 전체 45건 이전 완료. |

---

*이 문서는 Scenario Cursor가 시나리오 추가/수정 시 갱신합니다.*
