#!/usr/bin/env npx tsx
/**
 * AI PATIENT — SCENARIO PACK V1 generalization gate (live, operator-run).
 *
 * Runs CONTROLLED conversations — fixed learner lines, real patient model, real coaching review, real
 * safety screen — through the same service functions production uses, for every scenario:
 *
 *   listen  — acknowledges, asks open questions, brings the right person in, respects the choice
 *   cross   — reassures with certainty, decides for the patient, crosses the scenario's boundary
 *
 * Writes the full transcripts and coaching to a JSON report; prints a one-line verdict per run.
 * Spends on the dedicated AI Patient key ONLY: without AI_PATIENT_OPENAI_API_KEY it refuses to start.
 * The key is never printed. Nothing is stored anywhere else.
 *
 *   AI_PATIENT_OPENAI_API_KEY=… AI_PATIENT_SESSION_SECRET=gate npx tsx scripts/ai-patient-scenario-gate.ts <out.json> [scenarioId…]
 */
import { writeFileSync } from "node:fs";
import { newSession, reviewSession, takeTurn, isAiPatientAvailable } from "@/lib/bty/arena/aiPatient/aiPatientService";
import { AI_PATIENT_SCENARIO_IDS, isScenarioId, type AiPatientScenarioId } from "@/domain/arena/aiPatient/scenarioCatalog";
import { AI_PATIENT_SCENARIOS } from "@/domain/arena/aiPatient/scenarios";
import { breaksPatientRole, type AiPatientSessionState } from "@/domain/arena/aiPatient/sessionRules";

type Script = { listen: string[]; cross: string[] };

const SCRIPTS: Record<AiPatientScenarioId, Script> = {
  cost_concern: {
    listen: [
      "That's a completely fair reaction. Can I ask what part of this feels hardest right now?",
      "Thank you for telling me. Is it more the cost itself, or more whether you need the crown?",
      "That makes sense. The estimate is only an estimate until your insurance confirms it. Would it help if I found out what options we actually offer for spreading the cost?",
      "There's no pressure to decide today. What would feel like a good next step for you?",
    ],
    cross: [
      "Honestly, your insurance will cover most of it, so it'll be much less than that.",
      "And the crack is tiny, Dr. Patel is just being cautious.",
      "If you book today I can hold this price for you, but it goes up next week.",
    ],
  },
  just_pull_it: {
    listen: [
      "I hear you, that's a lot of money. What makes pulling it feel like the better option for you?",
      "That makes sense. Is it mostly the cost, or wanting it over with, or something else?",
      "Whether to save it or take it out is really a question for Dr. Patel. Would you like me to ask her to come back and go over both options with you?",
      "I don't have a price for taking it out yet, but I can find out so you can compare. Would that help?",
    ],
    cross: [
      "Pulling it would be a mistake. Saving the tooth is always the better choice.",
      "If you pull it, the other teeth will shift and you'll need an implant anyway.",
      "An extraction would only be about two hundred dollars, so it is cheaper, but you'll regret it.",
    ],
  },
  afraid_of_treatment: {
    listen: [
      "Thank you for telling me that. A lot of people feel that way. What part of it worries you most?",
      "That sounds really hard. Has something happened before that makes it feel that way?",
      "Would it help if I asked Dr. Patel to talk with you about what can be done to make it more comfortable?",
      "There's no rush. We can take this one step at a time. What would help you feel ready?",
    ],
    cross: [
      "Oh, you'll be fine, it won't hurt at all.",
      "It's just two small fillings, it's really nothing.",
      "We can give you sedation so you won't feel a thing. Let's just get you booked for next week.",
    ],
  },
  insurance_will_cover_it: {
    listen: [
      "That's a really good question. Can I ask what you've been told about what your plan covers?",
      "That makes sense. This sheet is our estimate. Your insurance company hasn't confirmed what it will pay yet.",
      "Would you like us to send them a pre-treatment estimate? It usually takes about two weeks, and it gives you more information before you decide.",
      "Is there anything else about the cost that would help you to know?",
    ],
    cross: [
      "Yes, with good insurance like yours, you're fully covered.",
      "The estimate is basically what they'll pay, so your part will be small.",
      "Don't worry about the paperwork, insurance always pays for crowns.",
    ],
  },
  why_do_i_need_this: {
    listen: [
      "That's a really fair question. What would help you feel sure about it?",
      "What Dr. Patel told you is that there's a crack next to an old filling and a crown would protect the tooth. I'm not the right person to explain more than that.",
      "Would you like me to ask Dr. Patel to come back and explain why she recommends it?",
      "Of course. There's no pressure to decide before you've heard from her.",
    ],
    cross: [
      "Because if you wait, the crack will spread and the tooth will split.",
      "Cracks like that always get worse, and then you'll need a root canal.",
      "Honestly, the doctor knows best, you should just trust her.",
    ],
  },
  need_it_today: {
    listen: [
      "I can see today took a lot to arrange. Can I ask why getting it done today matters so much?",
      "That makes sense, losing another day is hard. Let me be straight with you: today's schedule is full, and whether anything can be started today is Dr. Patel's call.",
      "Let me check with Dr. Patel what's possible today. The next crown opening is Tuesday morning, and I can put you on our cancellation list too.",
      "What would work best for you if today isn't possible?",
    ],
    cross: [
      "Sure, no problem, we can get it done today.",
      "We can just squeeze you in this afternoon, a crown only takes one visit.",
      "Sorry, policy is policy, you'll have to book another appointment.",
    ],
  },
  trust_after_bad_experience: {
    listen: [
      "I'm sorry it felt that way. Would you tell me what happened last time?",
      "Thank you for telling me. What would help you feel more comfortable this time?",
      "I'd like you to have costs explained up front this time. I can also ask our office manager, Ms. Lee, to follow up with you about last time.",
      "And if you have questions about the deep cleaning itself, I can ask Dr. Patel to explain it. What would you like to do next?",
    ],
    cross: [
      "I'm sure someone explained it to you.",
      "That's not what happened, our office always explains everything.",
      "Our office wouldn't do that. Anyway, you really need this deep cleaning.",
    ],
  },
};

async function converse(id: AiPatientScenarioId, lines: string[]) {
  let now = Date.now();
  let state: AiPatientSessionState = newSession("scenario-gate", now, id);
  const events: string[] = [];
  for (const line of lines) {
    now += 20_000;
    const r = await takeTurn(state, line, "text", now);
    if (!r.ok) {
      events.push(`turn_failed:${r.reason}`);
      break;
    }
    state = r.state;
    if (breaksPatientRole(r.patientText)) events.push("role_break");
  }
  const review = await reviewSession(state, now + 1000);
  return { turns: state.turns, concern: state.concern, events, review };
}

async function main() {
  const [out, ...only] = process.argv.slice(2);
  if (!out) throw new Error("usage: ai-patient-scenario-gate.ts <out.json> [scenarioId…]");
  if (!isAiPatientAvailable()) throw new Error("AI_PATIENT_OPENAI_API_KEY is not set — the gate spends on the dedicated AI Patient key only.");
  const ids = only.length ? only.filter(isScenarioId) : [...AI_PATIENT_SCENARIO_IDS];
  const report: Record<string, unknown> = {};
  for (const id of ids) {
    for (const mode of ["listen", "cross"] as const) {
      const r = await converse(id, SCRIPTS[id][mode]);
      report[`${id}.${mode}`] = r;
      const c = r.review.ok ? r.review.feedback.coaching : null;
      console.log(
        [
          `${id}.${mode}`,
          `patient=${AI_PATIENT_SCENARIOS[id].patientName}`,
          `turns=${r.turns.length}`,
          r.events.length ? `events=${r.events.join(",")}` : "events=none",
          r.review.ok ? `helped=${c!.helped.map((h) => h.key).join("+") || "-"}` : `review=${r.review.reason}`,
          c ? `safety=${c.safety.map((p) => p.kind).join("+") || "-"}` : "",
          c ? `screen=${r.review.ok ? r.review.feedback.safetyScreen : "-"}` : "",
        ].join(" "),
      );
    }
  }
  writeFileSync(out, JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
