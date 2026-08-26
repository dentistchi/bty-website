import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { resolveSuggestedTrainingName } from "./suggested-training-name";

/**
 * R4-R5C7A — the SUGGESTION contract.
 *
 * R4-R5C7 measured that `participant.display_name` reaches the Host and an observing colleague,
 * and that the learner chooses it today. So the rule below fills a field; it never decides an
 * identity, and it refuses every source that would publish something the learner did not pick.
 */

describe("T1/T2/T3 — the precedence, and where it stops", () => {
  it("T1 — full_name wins", () => {
    expect(resolveSuggestedTrainingName({ full_name: "Jonathan Smith", name: "Jon" })).toBe("Jonathan Smith");
  });
  it("T2 — name is used when full_name is absent", () => {
    expect(resolveSuggestedTrainingName({ name: "Jon" })).toBe("Jon");
  });
  it("T3 — neither present → null, and the learner types one", () => {
    expect(resolveSuggestedTrainingName({})).toBeNull();
    expect(resolveSuggestedTrainingName(null)).toBeNull();
    expect(resolveSuggestedTrainingName(undefined)).toBeNull();
  });
  it("whitespace and serialized absence are not names", () => {
    expect(resolveSuggestedTrainingName({ full_name: "   " })).toBeNull();
    expect(resolveSuggestedTrainingName({ full_name: "null" })).toBeNull();
    expect(resolveSuggestedTrainingName({ full_name: "undefined", name: "Jon" })).toBe("Jon");
    expect(resolveSuggestedTrainingName({ full_name: 42 as unknown as string, name: "Jon" })).toBe("Jon");
    expect(resolveSuggestedTrainingName({ full_name: "  Jon  " })).toBe("Jon");
  });
});

describe("T4/T5/T18 — the refused sources", () => {
  it("T4 — an account with ONLY an email gets no suggestion", () => {
    expect(resolveSuggestedTrainingName({ email: "j.smith88@company.com" })).toBeNull();
    expect(resolveSuggestedTrainingName({ email: "j.smith88@company.com", email_verified: true })).toBeNull();
  });

  it("T5/T18 — the resolver reads metadata only: no email, no Arena, no DB, no participant reuse", () => {
    const src = readFileSync(join(process.cwd(), "src/domain/foundry/events/suggested-training-name.ts"), "utf8");
    // Comments NAME the refused sources on purpose, so assert against code alone.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/email|arena_profiles|display_name|participant|supabase|from\(|\.split\(/i);
    // Exactly two metadata keys are ever read.
    const keys = [...code.matchAll(/metadata\.([a-z_]+)/g)].map((m) => m[1]);
    expect([...new Set(keys)].sort()).toEqual(["full_name", "name"]);
  });

  it("T18 — no room path reaches arena_profiles for a name", () => {
    for (const f of ["route.ts"]) void f;
    const routes = [
      "src/app/api/bty/foundry/public/[token]/route.ts",
      "src/app/api/bty/foundry/public/[token]/doc/snapshot/route.ts",
      "src/app/api/bty/foundry/public/[token]/guidance/snapshot/route.ts",
      "src/app/api/bty/foundry/public/[token]/join/route.ts",
    ];
    for (const r of routes) {
      const code = readFileSync(join(process.cwd(), r), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, r).not.toMatch(/arena_profiles|fullNameMap|normLabel/);
    }
  });
});

describe("domain purity", () => {
  it("the rule imports nothing", () => {
    const src = readFileSync(join(process.cwd(), "src/domain/foundry/events/suggested-training-name.ts"), "utf8");
    expect(src).not.toMatch(/^import /m);
  });
});

describe("T13 — the participant name stays a historical snapshot", () => {
  it("nothing added by this slice ever updates display_name", () => {
    const dir = join(process.cwd(), "src/lib/bty/foundry/events");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.includes(".test."))) {
      const code = readFileSync(join(dir, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      // display_name is written at INSERT only — never in an update payload.
      expect(code, f).not.toMatch(/\.update\(\{[^}]*display_name/);
    }
  });

  it("no migration was added", () => {
    /*
      RE-ANCHORED, NOT WEAKENED. This was written as "no migration newer than the day I shipped",
      which is a claim about the FUTURE and trips on every later slice that legitimately adds SQL.
      What it exists to catch is a migration smuggled in unnoticed — so later migrations are
      listed by name. Adding one means adding it here, deliberately, which is the signal.
    */
    const KNOWN_LATER = ["20260827000000_foundry_deferred_completion_claim_v1.sql"];
    const migs = readdirSync(join(process.cwd(), "supabase/migrations"))
      .filter((f) => /^\d{14}/.test(f) && f.slice(0, 8) > "20260826" && !KNOWN_LATER.includes(f));
    expect(migs).toEqual([]);
  });
});
