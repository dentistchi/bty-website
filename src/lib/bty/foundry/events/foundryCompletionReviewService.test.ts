/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyCompletionReview } from "./foundryCompletionReviewService";

/**
 * Slice 3.1B-3E.1 review read. Proves the owner+completed gate, that ownership is by the
 * immutable user_id_snapshot (never a client id), that only the caller's OWN stored content is
 * returned, and that every mismatch degrades to a neutral null (→ 404) with no disclosure.
 */

type Row = Record<string, unknown>;
function admin(tables: {
  assignment?: Row | null;
  event?: Row | null;
  progress?: Row | null;
}): SupabaseClient {
  return {
    from(table: string) {
      const data =
        table === "foundry_event_assignments" ? tables.assignment ?? null
        : table === "foundry_events" ? tables.event ?? null
        : table === "foundry_event_training_progress" ? tables.progress ?? null
        : null;
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        maybeSingle: () => Promise.resolve({ data, error: null }),
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

const OWNER = "user-hanbit";
const ASG = {
  id: "a1",
  event_id: "e5",
  participant_id: "p8",
  status: "completed",
  user_id_snapshot: OWNER,
  completed_at: "2026-07-20T19:45:22Z",
};
const EVENT = { title: "배가 고파", content_type: "youtube" };
const PROGRESS = {
  response_text: "I noticed I avoid hard conversations.",
  reflection: { whatEmerged: "clarity", whereYouStretched: "candor", livingSentence: "I choose truth.", nextInvitation: "one honest talk" },
  completion_state: "pass",
  completed_at: "2026-07-20T19:45:22Z",
};

describe("getMyCompletionReview", () => {
  it("returns the owner's own review with stored content", async () => {
    const r = await getMyCompletionReview(admin({ assignment: ASG, event: EVENT, progress: PROGRESS }), OWNER, "a1");
    expect(r).not.toBeNull();
    expect(r!.title).toBe("배가 고파");
    expect(r!.contentType).toBe("youtube");
    expect(r!.completedAt).toBe("2026-07-20T19:45:22Z");
    expect(r!.completionState).toBe("pass");
    expect(r!.responseText).toBe("I noticed I avoid hard conversations.");
    expect(r!.reflection?.livingSentence).toBe("I choose truth.");
  });

  it("NEUTRAL null when another account requests it (ownership = user_id_snapshot)", async () => {
    const r = await getMyCompletionReview(admin({ assignment: ASG, event: EVENT, progress: PROGRESS }), "someone-else", "a1");
    expect(r).toBeNull();
  });

  it("NEUTRAL null when the assignment is not completed", async () => {
    const r = await getMyCompletionReview(admin({ assignment: { ...ASG, status: "assigned" }, event: EVENT, progress: PROGRESS }), OWNER, "a1");
    expect(r).toBeNull();
  });

  it("NEUTRAL null when the assignment is missing / has no bound participant", async () => {
    expect(await getMyCompletionReview(admin({ assignment: null }), OWNER, "a1")).toBeNull();
    expect(await getMyCompletionReview(admin({ assignment: { ...ASG, participant_id: null } }), OWNER, "a1")).toBeNull();
  });

  it("does not synthesize: null reflection + null response when nothing was stored", async () => {
    const r = await getMyCompletionReview(
      admin({ assignment: ASG, event: EVENT, progress: { response_text: null, reflection: null, completion_state: null, completed_at: null } }),
      OWNER,
      "a1",
    );
    expect(r!.responseText).toBeNull();
    expect(r!.reflection).toBeNull();
    expect(r!.completionState).toBeNull();
  });
});
