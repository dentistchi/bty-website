import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assembleLivingResponsePacket } from "@/lib/bty/daily/livingResponseEvidence.server";
import { admitLivingResponse } from "@/domain/daily/livingResponse";
import { userDayKey } from "@/domain/daily/userDayKey";

const NOW = new Date("2026-07-12T12:00:00.000Z");
const TODAY = userDayKey(NOW, "UTC", 5);

// Scripted Supabase mock: terminal `.maybeSingle()` or awaited chain resolves per-table data.
function makeAdmin(script: Record<string, unknown[] | { single: unknown }>): SupabaseClient {
  const client = {
    from(table: string) {
      const b: Record<string, unknown> = {
        select: () => b, eq: () => b, in: () => b, not: () => b, gte: () => b, order: () => b, limit: () => b,
        maybeSingle: () => {
          const s = script[table];
          return Promise.resolve({ data: s && "single" in (s as object) ? (s as { single: unknown }).single : null, error: null });
        },
        then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
          resolve({ data: (Array.isArray(script[table]) ? (script[table] as unknown[]) : []), error: null }),
      };
      return b;
    },
  };
  return client as unknown as SupabaseClient;
}
const commitment = (relationship: "self" | "others" | "world") => ({ id: "c1", relationship, dayKey: TODAY, locale: "en" });

describe("assembleLivingResponsePacket — provenance-safe, correctly classified", () => {
  it("assembler derives the server-owned Commitment Frame from the relationship (no path/promise text)", async () => {
    const admin = makeAdmin({ user_day: [], dear_me_letters: [] });
    const packet = await assembleLivingResponsePacket(admin, "u1", commitment("self"), NOW);
    expect(packet.commitmentFrame.relationship).toBe("self");
    expect(packet.commitmentFrame.pathId).toBe("self_return_honestly");
    expect(packet.commitmentFrame.frameVersion).toBe("cf_v1");
  });

  it("a single same-day arrival yields a LOW fact → V2.1 commitment depth (history too weak for repetition)", async () => {
    const admin = makeAdmin({ user_day: [{ day_key: TODAY, timezone_snapshot: "UTC" }], dear_me_letters: [] });
    const packet = await assembleLivingResponsePacket(admin, "u1", commitment("self"), NOW);
    const returnFact = packet.facts.find((f) => f.evidenceClass === "self_return_continuity");
    expect(returnFact?.confidence).toBe("low");
    expect(returnFact?.provenanceIds).toContain(TODAY); // canonical day_key, not a count
    expect(packet.concepts).toEqual(expect.arrayContaining(["return", "consistency"])); // intrinsic self concepts
    const a = admitLivingResponse(packet);
    expect(a.eligible).toBe(true);
    expect(a.depth).toBe("commitment");
  });

  it("multi-day return continuity → STRONG fact → eligible at repetition depth", async () => {
    const days = ["2026-07-12", "2026-07-11", "2026-07-10", "2026-07-09"].map((day_key) => ({ day_key, timezone_snapshot: "UTC" }));
    const admin = makeAdmin({ user_day: days, dear_me_letters: [] });
    const packet = await assembleLivingResponsePacket(admin, "u1", commitment("self"), NOW);
    const f = packet.facts.find((x) => x.evidenceClass === "self_return_continuity");
    expect(f?.confidence).toBe("high");
    const a = admitLivingResponse(packet);
    expect(a.eligible).toBe(true);
    expect(a.depth).toBe("repetition");
  });

  it("an approved contract is NOT auto-classified Others (family must derive to Others)", async () => {
    // self_protection → axis 'control' → World, NOT Others → contributes no Others fact.
    const admin = makeAdmin({ bty_action_contracts: [{ id: "k1", pattern_family: "self_protection", verified_at: "2026-07-11T00:00:00Z" }], user_pattern_signatures: { single: null } });
    const packet = await assembleLivingResponsePacket(admin, "u1", commitment("others"), NOW);
    expect(packet.facts).toHaveLength(0); // no historical Others fact fabricated
    // frame alone still authorizes commitment depth (the confirmed decision is valid evidence)
    const a = admitLivingResponse(packet);
    expect(a.eligible).toBe(true);
    expect(a.depth).toBe("commitment");
  });

  it("a verified contract whose family derives to Others → relational fact → repetition depth", async () => {
    // ownership_escape → axis 'ownership' → Others.
    const admin = makeAdmin({ bty_action_contracts: [{ id: "k1", pattern_family: "ownership_escape", verified_at: "2026-07-11T00:00:00Z" }], user_pattern_signatures: { single: null } });
    const packet = await assembleLivingResponsePacket(admin, "u1", commitment("others"), NOW);
    const f = packet.facts.find((x) => x.evidenceClass === "others_verified_relational_action");
    expect(f).toBeTruthy();
    expect(f?.relationship).toBe("others");
    // ownership_escape → concept 'ownership' surfaces on the packet (makes copy SPECIFIC, not generic)
    expect(packet.concepts).toContain("ownership");
    const a = admitLivingResponse(packet);
    expect(a.eligible).toBe(true);
    expect(a.depth).toBe("repetition");
  });

  it("World assembles no historical facts but the frame authorizes commitment depth", async () => {
    const admin = makeAdmin({});
    const packet = await assembleLivingResponsePacket(admin, "u1", commitment("world"), NOW);
    expect(packet.facts).toHaveLength(0);
    expect(packet.commitmentFrame.pathId).toBe("world_build_stewardship");
    const a = admitLivingResponse(packet);
    expect(a.eligible).toBe(true);
    expect(a.depth).toBe("commitment");
  });
});
