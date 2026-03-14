# 시나리오 50개 목록

> Foundry/Arena 리더십 시나리오 파일 목록. 2026-03-09 SPRINT 16 TASK 7 작성.

---

## 위치

**디렉터리**: `docs/specs/scenarios/`  
**파일 형식**: `SCN_{PREFIX}_{NNNN}.json`  
**스키마**: `bty_scenario_v1`  
**총 개수**: **50개**

---

## ID 규칙

| 요소 | 설명 |
|------|------|
| **접두어** | `SCN_` (고정) |
| **PREFIX** | 시나리오 주제·유형 약어 (2~4자). 예: PT=Patient Treatment, FD=Front Desk, CG=Cross-Generational, EC=Ethical Courage |
| **번호** | 4자리 숫자 `NNNN` (0001~0048 등). 시나리오 고유 번호. |
| **예외** | `SCN_RESET_0001` — Stage 4 Reset 전용 시나리오. `SCN_WA_0001` — 워크아웃/특수 플로우. |

**전체 형식**: `SCN_{PREFIX}_{NNNN}.json` → `scenario_id`: `"SCN_{PREFIX}_{NNNN}"`

---

## 파일 목록 (50건)

| # | 파일명 | scenario_id | 비고 |
|---|--------|-------------|------|
| 1 | SCN_PT_0001.json | SCN_PT_0001 | Patient Treatment |
| 2 | SCN_FD_0002.json | SCN_FD_0002 | Front Desk |
| 3 | SCN_HQ_0003.json | SCN_HQ_0003 | |
| 4 | SCN_MP_0004.json | SCN_MP_0004 | |
| 5 | SCN_AS_0005.json | SCN_AS_0005 | |
| 6 | SCN_PNR_0006.json | SCN_PNR_0006 | |
| 7 | SCN_DC_0007.json | SCN_DC_0007 | |
| 8 | SCN_DE_0008.json | SCN_DE_0008 | |
| 9 | SCN_PO_0009.json | SCN_PO_0009 | |
| 10 | SCN_HB_0010.json | SCN_HB_0010 | |
| 11 | SCN_ID_0011.json | SCN_ID_0011 | |
| 12 | SCN_AG_0012.json | SCN_AG_0012 | |
| 13 | SCN_DD_0013.json | SCN_DD_0013 | |
| 14 | SCN_PA_0014.json | SCN_PA_0014 | |
| 15 | SCN_NA_0015.json | SCN_NA_0015 | |
| 16 | SCN_HI_0016.json | SCN_HI_0016 | |
| 17 | SCN_HP_0017.json | SCN_HP_0017 | |
| 18 | SCN_DA_0018.json | SCN_DA_0018 | |
| 19 | SCN_PC_0019.json | SCN_PC_0019 | |
| 20 | SCN_OC_0020.json | SCN_OC_0020 | |
| 21 | SCN_PQ_0021.json | SCN_PQ_0021 | |
| 22 | SCN_AM_0022.json | SCN_AM_0022 | |
| 23 | SCN_PL_0023.json | SCN_PL_0023 | |
| 24 | SCN_TM_0024.json | SCN_TM_0024 | |
| 25 | SCN_IC_0025.json | SCN_IC_0025 | |
| 26 | SCN_PX_0026.json | SCN_PX_0026 | |
| 27 | SCN_NE_0027.json | SCN_NE_0027 | |
| 28 | SCN_PP_0028.json | SCN_PP_0028 | |
| 29 | SCN_SL_0029.json | SCN_SL_0029 | |
| 30 | SCN_DP_0030.json | SCN_DP_0030 | |
| 31 | SCN_TU_0031.json | SCN_TU_0031 | |
| 32 | SCN_PF_0032.json | SCN_PF_0032 | |
| 33 | SCN_SR_0033.json | SCN_SR_0033 | |
| 34 | SCN_RV_0034.json | SCN_RV_0034 | |
| 35 | SCN_YC_0035.json | SCN_YC_0035 | |
| 36 | SCN_AO_0036.json | SCN_AO_0036 | |
| 37 | SCN_RF_0037.json | SCN_RF_0037 | |
| 38 | SCN_MO_0038.json | SCN_MO_0038 | |
| 39 | SCN_DR_0039.json | SCN_DR_0039 | |
| 40 | SCN_PCL_0040.json | SCN_PCL_0040 | |
| 41 | SCN_TC_0041.json | SCN_TC_0041 | |
| 42 | SCN_PI_0042.json | SCN_PI_0042 | |
| 43 | SCN_AD_0043.json | SCN_AD_0043 | |
| 44 | SCN_PDI_0044.json | SCN_PDI_0044 | |
| 45 | SCN_YR_0045.json | SCN_YR_0045 | |
| 46 | SCN_EC_0046.json | SCN_EC_0046 | 윤리적 용기 |
| 47 | SCN_CG_0047.json | SCN_CG_0047 | 세대 간 갈등 |
| 48 | SCN_RM_0048.json | SCN_RM_0048 | 원격 근무 리더십 |
| 49 | SCN_WA_0001.json | SCN_WA_0001 | 특수 플로우 |
| 50 | SCN_RESET_0001.json | SCN_RESET_0001 | Stage 4 Reset 전용 |

---

## 스키마 요약

각 JSON 파일은 다음 구조를 따른다.

| 필드 | 설명 |
|------|------|
| `schema_version` | `"bty_scenario_v1"` |
| `scenario_id` | 파일명과 동일 (예: `SCN_PT_0001`) |
| `title` | 시나리오 제목 |
| `summary` | 시나리오 요약 |
| `context_type` | relationship 등 |
| `stage_mapping` | `primary_stage`, `stage_flow` [1,2,3,4] |
| `roles_supported` | Doctor, Staff, Manager, DSO, Executive |
| `default_viewpoint` | Leader |
| `supports_reset` | boolean |
| `tags` | org, setting, themes, sensitivity |
| `scene` | setting, characters, beats |
| `choices` | A/B/C/D — label, intent, xp_base, difficulty, hidden_delta, result, micro_insight, follow_up |
| `coach_notes` | what_this_trains, why_it_matters (선택) |

상세 스키마는 **`docs/spec/FOUNDRY_DOMAIN_SPEC.md` §5 시나리오 파일 구조** 참조.

---

## 참조

- **도메인 스펙**: `docs/spec/FOUNDRY_DOMAIN_SPEC.md`
- **시스템 경계**: Foundry — `src/app/[locale]/bty/(protected)/`, `src/lib/bty/scenario/`
