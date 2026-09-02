import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * R4-R5C4A — the SCOPE FENCE.
 *
 * This slice deliberately refused server-side learner drafts. These guards make that refusal
 * checkable rather than remembered, and protect the submission semantics R4-R5C4 §8 measured:
 * two Host surfaces treat non-empty answer text as something to review, so a draft that ever
 * reached a final column would appear to a Host as a submitted answer.
 */

const ROOM = join(process.cwd(), "src/app/f/[token]");
const CLIENTS = ["FoundryJoinClient.tsx", "FoundryDocumentClient.tsx", "FoundryGuidanceClient.tsx"];
const src = (p: string) => readFileSync(p, "utf8");
/** Assertions target real code. Comments here NAME the things they refuse to do. */
const code = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("T14 — no server draft was built", () => {
  it("no migration was added in this slice", () => {
    const migs = readdirSync(join(process.cwd(), "supabase/migrations"));
    // 20260826 (C3A2 RPC) is the newest migration the repository should carry.
    /*
      RE-ANCHORED, NOT WEAKENED. This was written as "no migration newer than the day I shipped",
      which is a claim about the FUTURE and trips on every later slice that legitimately adds SQL.
      What it exists to catch is a migration smuggled in unnoticed — so later migrations are
      listed by name. Adding one means adding it here, deliberately, which is the signal.
    */
    const KNOWN_LATER = [
      "20260827000000_foundry_deferred_completion_claim_v1.sql",
      "20260828000000_bty_action_capture_v1.sql",
      "20260829000000_bty_microsoft_identity_resolver_v1.sql",
      "20260901000000_bty_action_capture_triage_v1.sql",
      "20260902000000_bty_tracked_announcements_v1.sql",
      "20260903000000_foundry_host_grant_provenance_v1.sql",
    ];
    const newer = migs.filter((f) => /^\d{14}/.test(f) && f.slice(0, 8) > "20260826" && !KNOWN_LATER.includes(f));
    expect(newer, "R4-R5C4A must add no migration").toEqual([]);
  });

  it("no draft column is written to any table", () => {
    for (const f of readdirSync(join(process.cwd(), "supabase/migrations"))) {
      const sql = readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8").replace(/^--.*$/gm, "");
      expect(sql, `${f}`).not.toMatch(/draft_response|draft_shared|draft_decision|draft_reflection|draft_saved_at/i);
    }
  });

  it("no draft API route exists", () => {
    const pub = join(process.cwd(), "src/app/api/bty/foundry/public/[token]");
    expect(existsSync(join(pub, "draft"))).toBe(false);
    const routes = readdirSync(pub);
    expect(routes.filter((r) => /draft/i.test(r))).toEqual([]);
  });

  it("the draft never travels over the network — the primitive touches localStorage only", () => {
    const c = code(src(join(ROOM, "useDeviceDraft.ts")));
    expect(c).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|navigator\.send/);
    expect(c).toContain("window.localStorage");
    // Explicitly forbidden by the brief, and unnecessary given the visibilitychange flush.
    expect(c).not.toMatch(/beforeunload/);
  });

  it("the completion payload still carries exactly the measured fields — nothing draft-shaped", () => {
    /*
      Read the ACTUAL object literal passed to the completion POST, rather than scanning the
      whole file: the hook is legitimately called with a `draftFields` argument elsewhere, and a
      whole-file match would flag that instead of the payload it is meant to protect.
    */
    for (const f of CLIENTS) {
      const c = code(src(join(ROOM, f)));
      const m = c.match(/post\(\s*"\/(?:progress\/)?complete"\s*,\s*\{([\s\S]*?)\n\s*\}\)/);
      expect(m, `${f}: completion payload not found`).toBeTruthy();
      const body = m![1] ?? "";
      const keys = [...body.matchAll(/(?:^|[{\s])([a-z_]+):/g)].map((x) => x[1]);
      expect(new Set(keys), f).toEqual(
        new Set(["response_text", "reflection_response", "shared_response", "decision_response", "tz"]),
      );
    }
  });
});

describe("T15 — no final answer column is written before Complete", () => {
  const SERVICES = ["foundryTrainingService.ts", "foundryDocumentService.ts", "foundryGuidanceService.ts"];
  it("each service writes the four answer columns in exactly ONE statement, the guarded completion", () => {
    for (const f of SERVICES) {
      const c = code(src(join(process.cwd(), "src/lib/bty/foundry/events", f)));
      const writes = [...c.matchAll(/\.update\(\{[^}]*response_text[^}]*\}/g)];
      expect(writes.length, `${f} must have exactly one answer-writing update`).toBe(1);
      // …and it remains the compare-and-set that makes completion atomic.
      expect(c).toContain('.is("completed_at", null)');
    }
  });

  it("the pre-completion endpoints still accept no learner text", () => {
    for (const r of ["progress/start", "progress/video-complete", "doc/reading", "guidance/declare"]) {
      const p = join(process.cwd(), "src/app/api/bty/foundry/public/[token]", r, "route.ts");
      const c = code(src(p));
      expect(c, r).not.toMatch(/response_text|shared_response|decision_response|reflection_response/);
    }
  });
});

describe("T16 — privacy: draft text may not leave the device by any route", () => {
  it("no draft text is logged, measured, or put in a URL", () => {
    const c = code(src(join(ROOM, "useDeviceDraft.ts")));
    expect(c).not.toMatch(/console\.|analytics|track\(|gtag|URLSearchParams|location\.(search|href)\s*=/);
  });

  it("the namespace never carries identity, and is never sent back to a server", () => {
    const ns = code(src(join(process.cwd(), "src/lib/bty/foundry/events/participant-draft-namespace.ts")));
    expect(ns).not.toMatch(/display_name|email|token_hash|auth|session/i);
    expect(ns).toContain("createHash");
    // Nothing in the API layer reads or accepts it — it authorises nothing.
    const api = join(process.cwd(), "src/app/api");
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".ts") && /draft_ns|participantDraftNamespace/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(api);
    expect(hits, "no API route may read the draft namespace").toEqual([]);
  });

  it("the room token is untouched and still identity-free", () => {
    const t = code(src(join(process.cwd(), "src/lib/bty/foundry/events/foundry-room-token.ts")));
    expect(t).not.toMatch(/draft/i);
  });

  it("no Host/admin projection gained the namespace or any draft field", () => {
    const dir = join(process.cwd(), "src/lib/bty/foundry/events");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.includes(".test."))) {
      if (f === "participant-draft-namespace.ts") continue;
      const c = code(src(join(dir, f)));
      if (!/draft_ns/.test(c)) continue;
      // The ONLY places allowed to mention it are the three room snapshots, which serve the
      // learner's own room and no one else's.
      expect(["foundryTrainingService.ts", "foundryDocumentService.ts", "foundryGuidanceService.ts"]).toContain(f);
    }
  });
});

describe("T17 — the three room families share ONE storage contract", () => {
  it("every client imports the shared primitive and none rolls its own", () => {
    for (const f of CLIENTS) {
      const c = code(src(join(ROOM, f)));
      expect(c, f).toContain('from "./useDeviceDraft"');
      expect(c, f).toContain("useRoomDraft(");
      // No client may reach for storage directly.
      expect(c, f).not.toMatch(/localStorage|sessionStorage/);
    }
  });

  it("all three call it with the same four arguments, in the same order", () => {
    for (const f of CLIENTS) {
      const c = code(src(join(ROOM, f)));
      expect(c, f).toContain("snapshot?.participant?.draft_ns ?? null");
      expect(c, f).toContain("restoreDraft,");
      expect(c, f).toContain("isCompletedStage(snapshot),");
    }
  });

  it("all four editable controls in every room are gated on hydration", () => {
    for (const f of CLIENTS) {
      const c = code(src(join(ROOM, f)));
      const gates = (c.match(/!draftReady/g) ?? []).length;
      expect(gates, `${f} must gate all four answer controls`).toBe(4);
    }
  });
});

describe("T18 — no promise inflation", () => {
  it("no room copy claims a server, account, cross-device or submitted save", () => {
    const forbidden =
      /your answer is saved|your progress is saved|continue where you left off|resume on another device|your answers are saved|saved to your account|이어서 계속|진행 상황이 저장/i;
    for (const f of [...CLIENTS, "useDeviceDraft.ts"]) {
      const strings = [...code(src(join(ROOM, f))).matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
      expect(strings.filter((v) => forbidden.test(v)), f).toEqual([]);
    }
  });

  it("this slice added no learner-facing save copy at all", () => {
    // Measured decision: 저장 is ALREADY the completion word in these three files
    // ("BTY에 저장되었습니다"), so a second, weaker save signal would collide with submission.
    for (const f of CLIENTS) {
      const c = code(src(join(ROOM, f)));
      expect(c, f).not.toMatch(/Draft saved|임시 저장/);
    }
  });
});
