/**
 * Product default: post-login goes straight to Elite V2 canonical Arena (`ELITE_CANONICAL_ENTRY_SCENARIO_ID`).
 * Legacy wizard (language, role/level, AIR baseline, learning path) + beginner redirect are off unless enabled.
 *
 * Set `BTY_POST_LOGIN_ONBOARDING_ENABLED=1` or `NEXT_PUBLIC_BTY_POST_LOGIN_ONBOARDING_ENABLED=1` to restore old gates.
 *
 * **Arena runtime:** {@link ELITE_CHAIN_SCENARIO_IDS} — payloads from {@link loadEliteDataset} (chain projection + e.g. OWN-RE-02-R1).
 */

/**
 * Canonical elite runtime scenario ids (chain workspace + vertical-slice scenarios).
 * Payloads come from {@link loadEliteDataset} — no `core_*` proxy for other ids.
 */
export const ELITE_CHAIN_SCENARIO_IDS = [
  "core_01_training_system",
  "core_06_lead_assistant",
  "core_11_staffing_collapse",
  /** OWN-RE-02-R1 — ownership / performance-review distortion (binding template; not a `core_*` alias). */
  "OWN-RE-02-R1",
] as const;

export type EliteChainScenarioId = (typeof ELITE_CHAIN_SCENARIO_IDS)[number];

/** First session after login — must be `ELITE_CHAIN_SCENARIO_IDS[0]` (canonical entry). */
export const ELITE_CANONICAL_ENTRY_SCENARIO_ID = ELITE_CHAIN_SCENARIO_IDS[0];

export function isEliteChainScenarioId(id: string): boolean {
  return (ELITE_CHAIN_SCENARIO_IDS as readonly string[]).includes(id);
}

export function isPostLoginOnboardingWizardEnabled(): boolean {
  return (
    process.env.BTY_POST_LOGIN_ONBOARDING_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_BTY_POST_LOGIN_ONBOARDING_ENABLED === "1"
  );
}
