/**
 * QA_C3_TESTABILITY_REVIEW_V1 §2 — fixture building blocks and canonical seed IDs for Arena integrity tests.
 *
 * **d9f reference:** Canonical recovery example `userId` in `docs/ARENA_CANONICAL_CONTRACT.md` §6 ends with suffix **`14d9f`** —
 * use {@link CANONICAL_CONTRACT_RECOVERY_USER_ID} when seeding “known bad / recovery” rows (TC-SCN-*, contract invariant drills).
 *
 * @see QA_C3_TESTABILITY_REVIEW_V1.md §2.1 (global blocks) and §2.2 (per-matrix seeds)
 */

/** ARENA_CANONICAL_CONTRACT.md §6 — `POST /api/admin/recover-contract` example user id. */
export const CANONICAL_CONTRACT_RECOVERY_USER_ID =
  "38ce28d2-79e4-4de5-b554-c10404714d9f" as const;

/** Same doc — example `runId` for recovery drills. */
export const CANONICAL_CONTRACT_RECOVERY_RUN_ID =
  "908cfb24-4280-4cce-aa87-4e5ce844b1f3" as const;

/** Same doc — example `scenarioId` for recovery drills. */
export const CANONICAL_CONTRACT_RECOVERY_SCENARIO_ID = "pswitch_ps_peer_1" as const;

/**
 * Global fixture blocks from QA_C3_TESTABILITY_REVIEW_V1 §2.1.
 * Each integration suite must declare which blocks it seeds before asserting TC-* / INV-*.
 */
export const QA_C3_FIXTURE_BLOCKS = [
  "user_eligibility",
  "scenario_template",
  "clock_control",
  "pattern_signal_seed",
  "action_contract_drafts",
  "validator_doubles",
  "level_state",
  "pipeline_config",
  "pending_contract",
  "escalation_human_path",
  "mirror_read",
] as const;

export type QAC3FixtureBlock = (typeof QA_C3_FIXTURE_BLOCKS)[number];

/** Minimum blocks required per test-case cluster (§2.2). */
export const QA_C3_FIXTURE_REQUIREMENTS: Record<string, readonly QAC3FixtureBlock[]> = {
  "TC-SCN-01": [
    "user_eligibility",
    "scenario_template",
    "clock_control",
    "action_contract_drafts",
    "pattern_signal_seed",
    "validator_doubles",
    "level_state",
    "pipeline_config",
  ],
  "TC-SCN-02": ["user_eligibility", "scenario_template", "clock_control", "pipeline_config"],
  "TC-SCN-03": ["user_eligibility", "scenario_template", "clock_control", "pipeline_config"],
  "TC-PAT-01": ["user_eligibility", "pattern_signal_seed", "clock_control", "scenario_template"],
  "TC-PAT-02": ["user_eligibility", "pattern_signal_seed", "clock_control", "scenario_template"],
  "TC-PAT-03": ["user_eligibility", "pattern_signal_seed", "clock_control", "scenario_template"],
  "TC-PAT-04": ["user_eligibility", "pending_contract", "pattern_signal_seed", "scenario_template"],
  "TC-AC-01": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-AC-02": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-AC-03": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-AC-04": [
    "user_eligibility",
    "action_contract_drafts",
    "validator_doubles",
    "escalation_human_path",
    "clock_control",
  ],
  "TC-L1-R1": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-L1-R2": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-L1-R3": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-L1-R4": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-L1-R5": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-L1-R6": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-L2-01": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-L2-02": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-L2-03": ["user_eligibility", "action_contract_drafts", "validator_doubles"],
  "TC-LVL-01": ["user_eligibility", "level_state", "scenario_template", "clock_control"],
  "TC-LVL-02": ["user_eligibility", "level_state", "scenario_template", "clock_control"],
  "TC-LVL-03": ["user_eligibility", "level_state", "clock_control"],
  "TC-PL-01": ["user_eligibility", "pipeline_config", "scenario_template"],
  "TC-PL-02": ["user_eligibility", "pipeline_config", "pending_contract"],
  "TC-PL-03": ["user_eligibility", "pipeline_config"],
  "TC-LK-01": ["user_eligibility", "scenario_template", "clock_control"],
  "TC-LK-02": ["user_eligibility", "pending_contract", "pattern_signal_seed"],
};
