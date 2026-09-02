import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Participant authority stays participant authority (Microsoft Manager Authority V1).
 *
 * Making Track a Host action is a narrow change, and the way it goes wrong is by spreading: a gate
 * added "for consistency" to the response surface would silently stop ordinary employees from
 * answering the very announcements they were sent. This is the boundary, asserted by file.
 */

const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const PARTICIPANT_ROUTES = [
  "src/app/api/bty/announcements/[id]/respond/route.ts",
  "src/app/api/bty/announcements/mine/route.ts",
];

describe("★ answering an announcement is NOT a Host action", () => {
  for (const route of PARTICIPANT_ROUTES) {
    it(`${route} carries no Host gate`, () => {
      const src = read(route);
      expect(src).toContain("requireConsentedUser");
      for (const gate of ["requireManager", "isActiveFoundryHost", "foundry_host_grants", "LEADER_TRACK"]) {
        expect(src.includes(gate), `${route} must not use ${gate}`).toBe(false);
      }
    });
  }

  it("the Track invoke, by contrast, DOES carry the Host gate", () => {
    // The mirror assertion: if this ever stops being true the gate has been lost, and the two
    // halves of the boundary are checked in the same place so they cannot drift apart unnoticed.
    const src = read("src/app/api/bty/teams/invoke/route.ts");
    expect(src).toContain("isActiveFoundryHost");
  });
});
