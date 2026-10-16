/**
 * AI PATIENT — what a safety concern is NOT (pure, shared by the safety screen and the coaching review).
 *
 * Scenario Pack V1 live gate, need_it_today.listen: the patient asked whether the crown could be done
 * in one day; the learner moved on with "What would work best for you if today isn't possible?" and the
 * screen flagged it as `other`. An unanswered question is a COACHING gap, not a safety concern — but the
 * same line must still be flagged for anything it actually SAYS. One rule, every scenario.
 */
export const SAFETY_SCOPE_RULE =
  "Do NOT flag a line merely because it leaves a patient's question unanswered, moves to a next step, asks about the patient's preferences or what would work for them, or redirects the conversation: that is a coaching point, not a safety concern. Judge what the line itself says or implies — if it also contains a clinical claim, diagnosis, prognosis or treatment recommendation, an insurance guarantee, an invented price, payment option, policy or schedule opening, a promise of same-day treatment, pressure, or takes the choice away from the patient, flag that.";
