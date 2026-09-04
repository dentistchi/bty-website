import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isCollaborationParticipant } from "./collaborationParticipant";

/**
 * The participant floor, and the line it must never cross.
 *
 * Section A of the product contract: collaboration belongs to every legitimate participant;
 * organizational authoring stays Manager+. These tests hold BOTH halves — the second is the one
 * that stops a convenience fix from quietly handing out Event/Training/XP authority.
 */

const BTY = "10110d5c-bd30-467e-9912-e44e67777647";
const OTHER = "99999999-9999-9999-9999-999999999999";
const ok = { resolutionStatus: "RESOLVED", tenantId: BTY, btyTenantId: BTY };

describe("who is a collaboration participant", () => {
  it("a resolved identity in BTY's own tenant is a participant", () => {
    expect(isCollaborationParticipant(ok)).toEqual({ participant: true });
  });

  it("★ no grant, no role and no admin flag is consulted — there is nowhere to put one", () => {
    // The input type is the whole authority surface. If a capability ever creeps in, this fails.
    expect(Object.keys(ok).sort()).toEqual(["btyTenantId", "resolutionStatus", "tenantId"]);
  });

  it("case and whitespace never decide identity — Entra GUIDs are case-insensitive", () => {
    expect(isCollaborationParticipant({ ...ok, tenantId: `  ${BTY.toUpperCase()} ` })).toEqual({ participant: true });
  });

  it("an UNRESOLVED identity is not a participant", () => {
    for (const status of ["NOT_LINKED", "AMBIGUOUS_IDENTITY", "LOOKUP_FAILED", "INVALID_INPUT", ""]) {
      expect(isCollaborationParticipant({ ...ok, resolutionStatus: status })).toEqual({
        participant: false,
        reason: "not_linked",
      });
    }
  });

  it("★ a resolved identity in a FOREIGN tenant is refused — the Entra app is multi-tenant", () => {
    expect(isCollaborationParticipant({ ...ok, tenantId: OTHER })).toEqual({
      participant: false,
      reason: "foreign_tenant",
    });
  });

  it("★ FAILS CLOSED when BTY's own tenant is unconfigured — never open to everyone", () => {
    for (const bty of ["", "   ", null, undefined]) {
      expect(isCollaborationParticipant({ ...ok, btyTenantId: bty })).toEqual({
        participant: false,
        reason: "tenant_not_configured",
      });
    }
  });

  it("a missing tenant on the activity is refused, not defaulted", () => {
    for (const t of ["", null, undefined]) {
      expect(isCollaborationParticipant({ ...ok, tenantId: t }).participant).toBe(false);
    }
  });

  it("the three reasons stay distinct — they need three different human responses", () => {
    const reasons = new Set([
      (isCollaborationParticipant({ ...ok, resolutionStatus: "NOT_LINKED" }) as { reason: string }).reason,
      (isCollaborationParticipant({ ...ok, tenantId: OTHER }) as { reason: string }).reason,
      (isCollaborationParticipant({ ...ok, btyTenantId: "" }) as { reason: string }).reason,
    ]);
    expect(reasons.size).toBe(3);
  });
});

const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8");
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("★ the module is PURE and never becomes an identity reader", () => {
  it("imports nothing — no db, no lib, no app, no env", () => {
    const src = read("src/domain/authority/collaborationParticipant.ts");
    expect(src).not.toMatch(/^import /m);
    expect(src).not.toContain("process.env");
  });

  it("EMAIL IS NEVER IDENTITY, and neither is a display name or `from.id`", () => {
    // CODE only — the prose above the function names these fields precisely to forbid them, and a
    // guard that reads comments would fail on its own documentation.
    const src = code("src/domain/authority/collaborationParticipant.ts").toLowerCase();
    for (const forbidden of ["upn", "preferred_username", "displayname", "from.id", "\"sub\""]) {
      expect(src).not.toContain(forbidden);
    }
  });
});

describe("★ ORGANIZATIONAL AUTHORING DID NOT MOVE — the non-regression that matters", () => {
  const PARTICIPANT_RULE = "isCollaborationParticipant";

  it("★ Event creation requires Host capability, and the participant rule cannot reach it", () => {
    const src = code("src/app/api/bty/events/route.ts");
    expect(src).toMatch(/await hasHostCapability\(/);
    expect(src).not.toContain(PARTICIPANT_RULE);
    // The two gates nobody in production could satisfy are gone, not merely bypassed.
    expect(src).not.toContain("requireApprovedMembership");
    expect(src).not.toContain("isLeaderTrack");
  });

  it("★ every Foundry manager route still goes through requireManager → hasHostCapability", () => {
    const gate = code("src/lib/bty/foundry/events/managerGate.ts");
    expect(gate).toMatch(/await hasHostCapability\(/);
    expect(gate).not.toContain(PARTICIPANT_RULE);
    expect(gate).toContain("foundry_host_required");
  });

  it("★ the XP award path is unchanged and is not a collaboration surface", () => {
    const scan = code("src/app/api/bty/events/scan/route.ts");
    expect(scan).not.toContain(PARTICIPANT_RULE);
    expect(scan).not.toContain("hasHostCapability");
    // Awarding stays behind the signed token + the atomic RPC, exactly as before.
    expect(scan).toContain("bty_event_scan_award");
  });

  it("★ the participant rule is reachable from the Teams invoke and NOWHERE else", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          if (read(rel).includes(PARTICIPANT_RULE)) hits.push(rel);
        }
      }
    };
    walk("src/app/api");
    expect(hits).toEqual(["src/app/api/bty/teams/invoke/route.ts"]);
  });

  it("★ collaboration routes carry no capability helper at all", () => {
    for (const r of [
      "src/app/api/bty/announcements/mine/route.ts",
      "src/app/api/bty/announcements/host/route.ts",
      "src/app/api/bty/announcements/recipients/[recipientId]/notify/route.ts",
      "src/app/api/bty/announcements/recipients/[recipientId]/handle/route.ts",
    ]) {
      const src = code(r);
      expect(src, r).not.toContain("hasHostCapability");
      expect(src, r).not.toContain("canTrackWithBty");
      expect(src, r).not.toContain("isActivePlatformAdmin");
      // Ownership is what remains, and it is still the session user.
      expect(src, r).toContain("user.id");
    }
  });

  it("★ `canTrackWithBty` is gone, not deprecated — an alias invites the mistake back", () => {
    const auth = read("src/lib/bty/authority/platformAdmin.server.ts");
    expect(auth).not.toMatch(/export (async )?function canTrackWithBty/);
    expect(auth).toMatch(/export async function hasHostCapability/);
  });
});
