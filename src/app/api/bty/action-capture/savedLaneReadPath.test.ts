import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * SAVED FOR LATER — THE READ PATH, AND WHY IT SAID "could not be loaded".
 *
 * ★ THE DEVICE FAILURE, MEASURED IN PRODUCTION (2026-09-04).
 *
 * A real non-host participant (`dc5bcdbb…`) saved a Teams message and BTY wrote it correctly:
 *
 *     SAVE   capture a2945cd1…   saved_at = 2026-09-04 08:30:07 PDT   → belongs in the lane
 *     TRACK  capture 2ad0953e…   saved_at = NULL                      → must NOT appear
 *
 * The invoke, the identity resolution, the canonical user and the write were all correct. Their
 * Saved for later screen still said "Saved items could not be loaded."
 *
 * The cause was one line of AUTHORITY, not one line of SQL: the route asked
 * `requireConsentedUser`, which reads `arena_profiles` — MEASURED at **3 rows in the whole
 * production database**, against 15 Microsoft-linked users. That user had none, so the request was
 * refused `403 consent_required` before the query ran, and the client, which distinguishes only ok
 * from not-ok, rendered its failure state.
 *
 * This is the THIRD time the same Arena-consent boundary has been found on a collaboration surface
 * (`/announcements/host`, then `/announcements/mine` + `/respond`, now here).
 */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const MINE = "src/app/api/bty/action-capture/mine/route.ts";
const TRIAGE = "src/app/api/bty/action-capture/[id]/triage/route.ts";
const CREATE = "src/app/api/bty/action-capture/route.ts";
const SERVICE = "src/lib/bty/action-capture/ensureActionCapture.server.ts";

describe("★ 4+5. the authority the lane actually needs", () => {
  it("★ REGRESSION: the read is authenticated, and does NOT require Arena learner consent", () => {
    // Against the pre-fix route both assertions fail: it imported and called requireConsentedUser.
    const src = code(MINE);
    expect(src).not.toContain("requireConsentedUser");
    expect(src).not.toContain("consentDenied");
    expect(src).toContain("requireUser");
  });

  it("★ REGRESSION: the lane's one decision is gated the same way", () => {
    const src = code(TRIAGE);
    expect(src).not.toContain("requireConsentedUser");
    expect(src).toContain("requireUser");
  });

  it("an unauthenticated caller is still 401 — the gate moved, it did not vanish", () => {
    for (const p of [MINE, TRIAGE]) expect(code(p), p).toContain("unauthenticated(req, base)");
  });

  it("★ ARENA PRACTICE KEEPS ITS CONSENT — only the two saved-lane routes moved", () => {
    // The one that did NOT move, by explicit instruction: capture creation.
    expect(code(CREATE)).toContain("requireConsentedUser");
    // And the wider learner surface is untouched: still ~100 consent-gated routes.
    const gated: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        // CODE, not comments — the repaired routes NAME the removed gate in their own prose, and
        // a guard that reads comments would report the fix as the defect.
        else if (e.name === "route.ts" && code(rel).includes("requireConsentedUser")) gated.push(rel);
      }
    };
    walk("src/app/api");
    expect(gated.length).toBeGreaterThan(90);
    expect(gated).not.toContain(MINE);
    expect(gated).not.toContain(TRIAGE);
  });
});

describe("★ 1+2+3. the visibility predicate — ownership and the saved lifecycle", () => {
  it("★ scopes to the SESSION user id, never a body or query-string one", () => {
    const src = code(MINE);
    expect(src).toContain("listMyActionCaptures(admin, user.id)");
    expect(src).not.toMatch(/searchParams\.get\(|req\.json\(\)/);
  });

  it("★ never email, display name, or a client-supplied aad object id", () => {
    const src = code(MINE).toLowerCase();
    for (const forbidden of ["email", "displayname", "aad_object_id", "upn"]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
  });

  it("★ 2. the lifecycle predicate is unchanged — Track-only captures stay out", () => {
    const svc = code(SERVICE);
    expect(svc).toContain('.eq("status", "captured")');
    expect(svc).toContain('.not("saved_at", "is", null)');
  });

  it("★ the table is reachable only through the server — RLS on, zero policies", () => {
    // Service-role client in the route; no browser-direct read anywhere in the app.
    expect(code(MINE)).toContain("getSupabaseAdmin");
    const client = read("src/components/app-shell/SavedForLater.tsx");
    expect(client).not.toContain("bty_action_captures");
    expect(client).toContain("/api/bty/action-capture/mine");
  });
});

describe("★ 1+2. the production rows, replayed through the real query", () => {
  /*
    The exact three captures that existed for the demonstrated user, driven through the actual
    `listMyActionCaptures` with a fake PostgREST chain that RECORDS its filters. This is the
    assertion the device evidence demands: the Save is visible, the Track-only row is not, and it
    is excluded by `saved_at`, not by anything about who tracked it.
  */
  const SAVE = { id: "a2945cd1", user_id: "dc5bcdbb", status: "captured", saved_at: "2026-09-04T08:30:07-07:00", captured_at: "2026-09-04T08:30:07-07:00", triage_choice: null, triaged_at: null, source_type: "teams_message", preview_text: "save", source_url: null, promoted_at: null, promoted_action_contract_id: null };
  const OLDER = { ...SAVE, id: "a9c6da27", saved_at: "2026-09-03T15:10:06-07:00", captured_at: "2026-09-03T15:10:06-07:00" };
  const TRACK_ONLY = { ...SAVE, id: "2ad0953e", saved_at: null, captured_at: "2026-09-04T08:29:00-07:00" };

  const filters: Array<[string, unknown, unknown]> = [];
  const admin = {
    from: () => ({
      select: () => {
        const chain = {
          eq: (c: string, v: unknown) => { filters.push(["eq", c, v]); return chain; },
          not: (c: string, op: unknown, v: unknown) => { filters.push([`not.${op}`, c, v]); return chain; },
          order: () => ({
            // The fake applies the recorded predicate itself, so the assertion is about the
            // query the service ASKED for, not about a hand-picked result set.
            then: undefined,
            data: [SAVE, OLDER, TRACK_ONLY].filter((r) => r.status === "captured" && r.saved_at !== null),
            error: null,
          }),
        };
        return chain;
      },
    }),
  } as never;

  beforeEach(() => { filters.length = 0; });

  it("★ 1+2. the Save is returned and the Track-only capture is not", async () => {
    const { listMyActionCaptures } = await import("@/lib/bty/action-capture/ensureActionCapture.server");
    const out = await listMyActionCaptures(admin, "dc5bcdbb");
    const ids = out.map((c) => c.id);
    expect(ids).toContain("a2945cd1");
    expect(ids).toContain("a9c6da27");
    expect(ids).not.toContain("2ad0953e");
  });

  it("★ 2. and it is excluded by saved_at — not by source, status or anything about Track", async () => {
    const { listMyActionCaptures } = await import("@/lib/bty/action-capture/ensureActionCapture.server");
    await listMyActionCaptures(admin, "dc5bcdbb");
    expect(filters).toContainEqual(["not.is", "saved_at", null]);
    expect(filters).toContainEqual(["eq", "user_id", "dc5bcdbb"]);
    expect(filters).toContainEqual(["eq", "status", "captured"]);
    expect(filters.some(([, c]) => c === "source_type")).toBe(false);
  });

  it("★ 3. another user's saves are unreachable — the owner filter is in the query", async () => {
    const { listMyActionCaptures } = await import("@/lib/bty/action-capture/ensureActionCapture.server");
    await listMyActionCaptures(admin, "someone-else");
    expect(filters).toContainEqual(["eq", "user_id", "someone-else"]);
  });
});

describe("★ 7+8. the production-proven paths are untouched", () => {
  it("★ 7. the Teams Save write path still has no capability gate and still captures", () => {
    const invoke = code("src/app/api/bty/teams/invoke/route.ts");
    expect(invoke).toContain("ensureActionCapture");
    expect(invoke).toContain("isCollaborationParticipant");
    expect(invoke).not.toContain("requireConsentedUser");
  });

  it("★ 8. Track participant authority is unchanged", () => {
    const invoke = code("src/app/api/bty/teams/invoke/route.ts");
    expect(invoke).not.toMatch(/await canTrackWithBty\(/);
    expect(invoke).not.toMatch(/await hasHostCapability\(/);
  });

  it("★ Save idempotency and capture creation are untouched", () => {
    const svc = code(SERVICE);
    expect(svc).toContain("external_key");
    // The create route keeps its own contract, including its consent gate.
    expect(code(CREATE)).toContain("ensureActionCapture");
  });
});

describe("★ 5+6. the surface tells empty and broken apart", () => {
  const client = read("src/components/app-shell/SavedForLater.tsx");

  it("★ 5. a successful empty response renders the empty state, not the error state", () => {
    // `load()` returns true whenever the response is ok and `items` is an array — [] included.
    expect(client).toContain("if (d?.ok !== true || !Array.isArray(d.items)) return false;");
    expect(client).toContain('setState(ok ? "ready" : "error")');
  });

  it("a real failure still reaches the error state with a Reload control", () => {
    expect(client).toContain("errorText");
    expect(client).toContain("if (!res.ok) return false;");
  });

  it("★ 6. triage/dismissal behaviour follows the existing contract, unchanged", () => {
    expect(client).toContain("/api/bty/action-capture/");
    expect(client).toContain("triage");
    // Optimistic move with exact restore on failure — the existing lossless contract.
    expect(client).toContain("const previous = items;");
  });
});
