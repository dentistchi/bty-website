/**
 * AI PATIENT — the scenario catalog the learner chooses from (pure, client-safe).
 *
 * Titles and one-line descriptions ONLY. The case files — hidden concerns, what each patient knows,
 * the reviewers' facts — live in scenarios.ts, which is server-only, so nothing here can reveal what a
 * patient is really worried about.
 */

export const AI_PATIENT_SCENARIO_IDS = [
  "cost_concern",
  "just_pull_it",
  "afraid_of_treatment",
  "insurance_will_cover_it",
  "why_do_i_need_this",
  "need_it_today",
  "trust_after_bad_experience",
] as const;
export type AiPatientScenarioId = (typeof AI_PATIENT_SCENARIO_IDS)[number];

/** The original Case Acceptance situation stays the default. */
export const DEFAULT_SCENARIO_ID: AiPatientScenarioId = "cost_concern";

export const isScenarioId = (v: unknown): v is AiPatientScenarioId =>
  typeof v === "string" && (AI_PATIENT_SCENARIO_IDS as readonly string[]).includes(v);

export const AI_PATIENT_SCENARIO_CATALOG: ReadonlyArray<{ id: AiPatientScenarioId; title: string; description: string }> = [
  { id: "cost_concern", title: "Cost Concern", description: "The estimate is more than the patient expected." },
  { id: "just_pull_it", title: "Just Pull It", description: "The patient would rather have the tooth taken out." },
  { id: "afraid_of_treatment", title: "Afraid of Treatment", description: "Dental treatment really scares the patient." },
  { id: "insurance_will_cover_it", title: "Insurance Will Cover It", description: "The patient is sure insurance will pay for all of it." },
  { id: "why_do_i_need_this", title: "Why Do I Need This?", description: "The tooth doesn't hurt, and the patient wants to know why." },
  { id: "need_it_today", title: "I Need It Today", description: "The patient took the day off and wants it done now." },
  { id: "trust_after_bad_experience", title: "I Don't Trust This Office", description: "A past visit here left the patient doubtful." },
];
