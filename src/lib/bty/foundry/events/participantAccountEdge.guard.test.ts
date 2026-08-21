import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  isParticipantAccountCompatible,
  mayAttributeToAccount,
} from "@/domain/foundry/events/participant-account";

/**
 * R4-R5C3A1 — PRIVACY, TOKEN AND SCOPE GUARDS for the participant account edge.
 *
 * `participants.user_id` makes a row identifying where it deliberately was not. R4-R5C3 §8
 * measured that every one of the 13 reads of that table uses an explicit column allow-list, that
 * there is not a single `select("*")`, and that no DTO spreads a participant row — which is the
 * only reason this migration is safe without rewriting projections.
 *
 * These tests do not rewrite anything. They PROTECT what is already correct, so the next person
 * cannot make the table leak by reaching for a wildcard.
 */

const EVENTS_DIR = join(process.cwd(), "src/lib/bty/foundry/events");
const sources = () =>
  readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
    .map((f) => ({ file: f, src: readFileSync(join(EVENTS_DIR, f), "utf8") }));

/** Source with comments stripped — assertions must target real code, never prose about it. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("T10 — no projection may expose the account edge", () => {
  it("no service reads foundry_event_participants with select(\"*\")", () => {
    for (const { file, src } of sources()) {
      const c = code(src);
      const idx = c.indexOf('from("foundry_event_participants")');
      if (idx === -1) continue;
      // Look at the whole file: a wildcard anywhere near this table is the failure mode.
      expect(c.includes('select("*")'), `${file} must not use select("*")`).toBe(false);
    }
  });

  it("exactly ONE read selects user_id — the session lookup that the compatibility rule needs", () => {
    const withUserId: string[] = [];
    for (const { file, src } of sources()) {
      for (const m of code(src).matchAll(/\.select\("([^"]*user_id[^"]*)"\)/g)) {
        // Only count selects that are reading the PARTICIPANT table's own user_id column.
        if (/display_name|participant_session_token_hash|last_seen_at/.test(m[1] ?? "")) {
          withUserId.push(`${file}: ${m[1]}`);
        }
      }
    }
    // TWO, both in the one service that owns the table: the session lookup the compatibility
    // rule reads, and the insert-returning select on the row it just created. Any third would be
    // a new projection and must be reviewed.
    expect(withUserId).toEqual([
      "foundryEventService.ts: id, event_id, display_name, status, joined_at, last_seen_at, user_id",
      "foundryEventService.ts: id, event_id, display_name, status, joined_at, last_seen_at, user_id",
    ]);
  });

  it("no Host / learner / public DTO carries the edge", () => {
    // The projections that reach a human: roster, observation subject, host attention,
    // follow-up rows, shared review, and the public room snapshot.
    for (const { file, src } of sources()) {
      const c = code(src);
      /*
        A DTO FIELD, not an internal read. The containment rule legitimately reads
        `resolvedParticipant?.user_id` inside the service; what must never happen is the value
        being NAMED as a field of an object that leaves the service.
      */
      /*
        The source column must be named too. `userId: p.linked_user_id` (foundrySharedReviewService)
        is a PRE-EXISTING internal projection of the PROGRESS row's own column and is not this
        table's edge — a guard that flagged it would be testing the wrong `user_id`.
      */
      expect(c, `${file}`).not.toMatch(/\buser_?[Ii]d:\s*[A-Za-z]*[.?]user_id\b/);
    }
  });

  it("the public snapshot still builds the participant literal by hand (no spread)", () => {
    const src = code(readFileSync(join(EVENTS_DIR, "foundryEventService.ts"), "utf8"));
    expect(src).toContain("participant: { display_name: participant.display_name, joined_at: participant.joined_at }");
    expect(src).not.toMatch(/participant:\s*\{\s*\.\.\./);
  });
});

describe("T11 — the join token stays identity-free", () => {
  it("the token payload names only the event and its version", () => {
    const src = readFileSync(join(EVENTS_DIR, "foundry-room-token.ts"), "utf8");
    expect(src).toContain('type: "foundry_room";');
    expect(src).toContain("eventId: string;");
    expect(src).toContain("joinVersion: number;");
    expect(code(src)).not.toMatch(/userId|authUserId|accountId|user_id/);
  });

  it("the account edge is never accepted from a request payload", () => {
    const joinRoute = code(
      readFileSync(join(process.cwd(), "src/app/api/bty/foundry/public/[token]/join/route.ts"), "utf8"),
    );
    // The only value taken from the body is the display name.
    expect(joinRoute).toContain("body?.display_name");
    expect(joinRoute).not.toMatch(/body\?\.\s*user_?[Ii]d/);
    // …and the id that IS used comes from the session.
    expect(joinRoute).toContain("supa.auth.getUser()");
  });

  it("the public routes stay public — no 401 gate was introduced", () => {
    for (const rel of [
      "src/app/api/bty/foundry/public/[token]/route.ts",
      "src/app/api/bty/foundry/public/[token]/join/route.ts",
      "src/app/api/bty/foundry/public/[token]/doc/snapshot/route.ts",
      "src/app/api/bty/foundry/public/[token]/guidance/snapshot/route.ts",
    ]) {
      const src = code(readFileSync(join(process.cwd(), rel), "utf8"));
      expect(src, rel).not.toMatch(/unauthenticated|401/);
    }
  });
});

/*
  PHASE FENCE, RETIRED ON SCHEDULE (R4-R5C3A2).

  This block asserted "Phase 1 does not expose Continue learning" — the union is two states, the
  RPC projects `a.status` verbatim, the card says only Start. That fence did its job: when C3A2
  landed it failed three times, once for each half of the change, which is the pre-fix proof that
  the change is real and observable rather than a no-op.

  Phase 2 is now authorized, so the fence is REPLACED, not deleted and not weakened. What follows
  guards the properties that must survive Phase 2 — the ones C3A1 actually bought.
*/
describe("T12 — Phase 2 derives the third state without persisting it", () => {
  it("the union is three states, and in_progress is documented as DERIVED", () => {
    const svc = readFileSync(join(EVENTS_DIR, "foundryLearnerAssignmentService.ts"), "utf8");
    expect(svc).toContain('export type LearnerAssignmentStatus = "assigned" | "in_progress" | "completed";');
    expect(svc).toMatch(/DERIVED at read time/);
  });

  it("nothing writes in_progress to the assignment row", () => {
    // The projection is a read. If a migration ever STORES this value, the assignment table stops
    // being the record of what was assigned and completed, and completion loses its single author.
    for (const f of readdirSync(join(process.cwd(), "supabase/migrations"))) {
      const sql = readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8")
        .replace(/^--.*$/gm, "");
      expect(sql, `${f} must not persist in_progress`).not.toMatch(
        /(insert into|update)\s+[^;]*foundry_event_assignments[^;]*'in_progress'/i,
      );
    }
  });

  it("completion is still decided by a.status alone, and tested FIRST", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260826000000_foundry_list_my_assignments_v2_in_progress.sql"),
      "utf8",
    ).replace(/^--.*$/gm, "");
    // `completed` is the first branch of the case, so no participant state can downgrade it.
    expect(sql.indexOf("when a.status = 'completed' then 'completed'")).toBeLessThan(
      sql.indexOf("then 'in_progress'"),
    );
    // The rows the function considers are unchanged: still only the caller's own two real states.
    expect(sql).toContain("a.status in ('assigned', 'completed')");
    // Ordering still reads the PERSISTED column, so sort order cannot drift with the projection.
    expect(sql).toContain("case when a.status = 'assigned' then 0 else 1 end");
  });

  it("the derivation depends on the C3A1 account edge — the whole reason it is allowed to exist", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260826000000_foundry_list_my_assignments_v2_in_progress.sql"),
      "utf8",
    ).replace(/^--.*$/gm, "");
    expect(sql).toContain("p.user_id = p_auth_user_id");
    expect(sql).toContain("p.status = 'joined'");
    expect(sql).toContain("g.completed_at is null");
    // No display_name, email or session-token matching ever substitutes for the edge.
    expect(sql).not.toMatch(/display_name|email|participant_session_token_hash/i);
  });

  it("joining is still not starting — a real material marker is required", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260826000000_foundry_list_my_assignments_v2_in_progress.sql"),
      "utf8",
    ).replace(/^--.*$/gm, "");
    for (const marker of [
      "g.video_started_at is not null",
      "g.document_last_page is not null",
      "coalesce(g.document_active_read_ms, 0) > 0",
      "g.written_guidance_read_at is not null",
      "g.discussion_self_reported_at is not null",
    ]) {
      expect(sql, marker).toContain(marker);
    }
    // The NOT NULL DEFAULT 0 column must never be tested for presence — every row would qualify.
    expect(sql).not.toMatch(/document_active_read_ms\s+is not null/i);
  });

  it("the card offers Continue only for the derived state", () => {
    const card = readFileSync(
      join(process.cwd(), "src/components/foundry/event-rooms/FoundryRequiredLearning.tsx"),
      "utf8",
    );
    expect(card).toContain('startCta: "Start learning"');
    expect(card).toContain('a.status === "in_progress" ? t.continueCta : t.startCta');
  });
});

describe("the compatibility rule itself", () => {
  it("refuses exactly one case, and nothing else", () => {
    expect(isParticipantAccountCompatible("A", "A")).toBe(true); // same person returning
    expect(isParticipantAccountCompatible("A", "B")).toBe(false); // the only refusal
    expect(isParticipantAccountCompatible("A", null)).toBe(true); // signed-out room use
    expect(isParticipantAccountCompatible(null, "B")).toBe(true); // anonymous → signed in
    expect(isParticipantAccountCompatible(null, null)).toBe(true); // ordinary anonymous
    expect(isParticipantAccountCompatible(undefined, undefined)).toBe(true); // legacy row
  });

  it("account attribution additionally requires an account to attribute to", () => {
    expect(mayAttributeToAccount("A", "A")).toBe(true);
    expect(mayAttributeToAccount(null, "B")).toBe(true); // the anonymous claim path
    expect(mayAttributeToAccount("A", "B")).toBe(false);
    expect(mayAttributeToAccount("A", null)).toBe(false); // nothing to credit
    expect(mayAttributeToAccount(null, null)).toBe(false);
  });
});

describe("the migration is additive and matches repository convention", () => {
  const raw = readFileSync(
    join(process.cwd(), "supabase/migrations/20260825000000_foundry_participant_account_edge_v1.sql"),
    "utf8",
  );
  /* Assertions target real SQL. The header prose deliberately NAMES the things it refuses to do
     ("NO unique (event_id, user_id)", "NO BACKFILL"), so a whole-file match would test the essay. */
  const sql = raw.replace(/^--.*$/gm, "");

  it("adds one nullable column with the auth.users convention already used by siblings", () => {
    expect(sql).toContain("add column if not exists user_id uuid null references auth.users (id) on delete set null");
    const sibling = readFileSync(
      join(process.cwd(), "supabase/migrations/20260721000000_foundry_assignment_foundation_v1.sql"),
      "utf8",
    );
    expect(sibling, "the convention this follows must actually exist").toContain(
      "user_id uuid null references auth.users (id) on delete set null",
    );
  });

  it("creates the partial index and NO unique constraint", () => {
    expect(sql).toContain("where user_id is not null");
    expect(sql.toLowerCase()).not.toContain("unique (event_id, user_id)");
    expect(sql.toLowerCase()).not.toContain("unique(event_id, user_id)");
  });

  it("performs no backfill and no data write of any kind", () => {
    for (const f of ["update ", "insert into", "delete from"]) {
      expect(sql.toLowerCase(), `migration must not ${f.trim()}`).not.toContain(f);
    }
  });
});
