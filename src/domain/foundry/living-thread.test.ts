import { describe, it, expect } from "vitest";
import {
  evaluateThreadEligibility,
  buildEvidencePacket,
  evidenceFingerprint,
  validateLivingThread,
  LIVING_THREAD_PROMPT_VERSION,
  type FoundryHistoryRecord,
} from "./living-thread";

function rec(over: Partial<FoundryHistoryRecord> & { eventId: string; completedAt: string }): FoundryHistoryRecord {
  return {
    eventTitle: "Training " + over.eventId,
    responseText: "I noticed the cost of staying silent with my team.",
    aiReflectionLine: null,
    completionState: "pass",
    ...over,
  };
}

// Three eligible records across a 20-day span (default happy path).
const THREE_ELIGIBLE: FoundryHistoryRecord[] = [
  rec({ eventId: "e1", completedAt: "2026-05-01T10:00:00Z", responseText: "I delayed the conversation with my manager." }),
  rec({ eventId: "e2", completedAt: "2026-05-10T10:00:00Z", responseText: "I told myself I was protecting the team." }),
  rec({ eventId: "e3", completedAt: "2026-05-21T10:00:00Z", responseText: "The delay is now costing the team clarity." }),
];

describe("evaluateThreadEligibility", () => {
  it("0 records → none, not eligible", () => {
    expect(evaluateThreadEligibility([]).status).toBe("none");
  });
  it("1 record → one, not eligible", () => {
    expect(evaluateThreadEligibility([THREE_ELIGIBLE[0]]).status).toBe("one");
  });
  it("2 records → two, not eligible", () => {
    const r = evaluateThreadEligibility(THREE_ELIGIBLE.slice(0, 2));
    expect(r.status).toBe("two");
    expect(r.eligible).toBe(false);
  });
  it("3 records from the SAME event → counts once → not eligible", () => {
    const same = [
      rec({ eventId: "eX", completedAt: "2026-05-01T10:00:00Z" }),
      rec({ eventId: "eX", completedAt: "2026-05-10T10:00:00Z" }),
      rec({ eventId: "eX", completedAt: "2026-05-21T10:00:00Z" }),
    ];
    const r = evaluateThreadEligibility(same);
    expect(r.eligibleCount).toBe(1);
    expect(r.eligible).toBe(false);
  });
  it("3 distinct events but span < 14 days → gathering, not eligible", () => {
    const near = [
      rec({ eventId: "e1", completedAt: "2026-05-01T10:00:00Z" }),
      rec({ eventId: "e2", completedAt: "2026-05-03T10:00:00Z" }),
      rec({ eventId: "e3", completedAt: "2026-05-08T10:00:00Z" }),
    ];
    const r = evaluateThreadEligibility(near);
    expect(r.status).toBe("gathering");
    expect(r.eligible).toBe(false);
  });
  it("3 eligible across ≥14 days → eligible", () => {
    const r = evaluateThreadEligibility(THREE_ELIGIBLE);
    expect(r.status).toBe("eligible");
    expect(r.eligible).toBe(true);
    expect(r.eligibleCount).toBe(3);
    expect(r.spanDays).toBeGreaterThanOrEqual(14);
  });
  it("records without real user text are not counted", () => {
    const withBlank = [
      ...THREE_ELIGIBLE.slice(0, 2),
      rec({ eventId: "e3", completedAt: "2026-05-21T10:00:00Z", responseText: "   " }),
    ];
    expect(evaluateThreadEligibility(withBlank).eligibleCount).toBe(2);
  });
});

describe("evidenceFingerprint", () => {
  it("same evidence + prompt version → same fingerprint", () => {
    expect(evidenceFingerprint(THREE_ELIGIBLE)).toBe(evidenceFingerprint([...THREE_ELIGIBLE].reverse()));
  });
  it("changed user text → new fingerprint", () => {
    const edited = [
      THREE_ELIGIBLE[0],
      THREE_ELIGIBLE[1],
      { ...THREE_ELIGIBLE[2], responseText: "A different reflection entirely." },
    ];
    expect(evidenceFingerprint(edited)).not.toBe(evidenceFingerprint(THREE_ELIGIBLE));
  });
  it("carries the prompt version", () => {
    expect(evidenceFingerprint(THREE_ELIGIBLE).startsWith(LIVING_THREAD_PROMPT_VERSION + ":")).toBe(true);
  });
});

describe("validateLivingThread", () => {
  const packet = buildEvidencePacket(THREE_ELIGIBLE);
  const good = {
    thread: "Across these three reflections, responsibility appears at the moment delay begins to reach the team.",
    supportingMoments: [
      { eventId: "e1", excerpt: "I delayed the conversation with my manager." },
      { eventId: "e3", excerpt: "The delay is now costing the team clarity." },
    ],
    nextQuestion: "Where does responsibility become action before the cost reaches the team?",
  };

  it("accepts a grounded, date-anchored thread", () => {
    expect(validateLivingThread(good, packet).ok).toBe(true);
  });

  it("rejects recurrence-as-character language", () => {
    expect(validateLivingThread({ ...good, thread: "You always avoid difficult conversations." }, packet).ok).toBe(false);
    expect(validateLivingThread({ ...good, thread: "You keep choosing responsibility." }, packet).ok).toBe(false);
  });

  it("rejects identity diagnosis and guaranteed-growth claims", () => {
    expect(validateLivingThread({ ...good, thread: "This is who you are as a leader." }, packet).ok).toBe(false);
    expect(validateLivingThread({ ...good, thread: "You are becoming a courageous leader." }, packet).ok).toBe(false);
    expect(validateLivingThread({ ...good, thread: "A pattern is emerging in you." }, packet).ok).toBe(false);
  });

  it("rejects psychological inference", () => {
    expect(validateLivingThread({ ...good, thread: "Deep down, you fear disappointing others." }, packet).ok).toBe(false);
  });

  it("rejects a supporting moment that references a fabricated event", () => {
    const bad = { ...good, supportingMoments: [{ eventId: "e1", excerpt: "x" }, { eventId: "NOT_REAL", excerpt: "y" }] };
    const r = validateLivingThread(bad, packet);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("fabricated_event");
  });

  it("requires 2–3 supporting moments", () => {
    expect(validateLivingThread({ ...good, supportingMoments: [{ eventId: "e1", excerpt: "x" }] }, packet).ok).toBe(false);
  });

  it("rejects a next question that is not grounded (no question mark)", () => {
    expect(validateLivingThread({ ...good, nextQuestion: "Think about how you lead." }, packet).ok).toBe(false);
  });

  it("accepts a thread with no next question", () => {
    expect(validateLivingThread({ ...good, nextQuestion: null }, packet).ok).toBe(true);
  });

  it("rejects a patience-retreat next question against a delay/cost frame", () => {
    // The packet excerpts are about delay + cost to the team → framed.
    const bad = { ...good, nextQuestion: "What will you change, in your own time?" };
    const r = validateLivingThread(bad, packet);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invitation_contradicts_frame");
  });
});
