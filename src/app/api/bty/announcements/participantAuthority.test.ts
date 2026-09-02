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
      /*
        Was `requireConsentedUser` until A1-VIS-R3. The Arena learner-consent gate was measured to
        be the wrong boundary for a Teams workplace message workflow and was removed from both
        recipient routes; what this assertion cares about is unchanged and stated directly below —
        an authenticated caller, and NO Host gate.
      */
      expect(src).toContain("requireUser");
      for (const gate of [
        "requireManager",
        "isActiveFoundryHost",
        "canTrackWithBty",
        "isActivePlatformAdmin",
        "foundry_host_grants",
        "bty_platform_admin_grants",
        "LEADER_TRACK",
      ]) {
        expect(src.includes(gate), `${route} must not use ${gate}`).toBe(false);
      }
    });
  }

  it("the Track invoke, by contrast, DOES carry the Host-capability gate", () => {
    // The mirror assertion: if this ever stops being true the gate has been lost, and the two
    // halves of the boundary are checked in the same place so they cannot drift apart unnoticed.
    //
    // The gate widened on 2026-09-02 from `isActiveFoundryHost` to `canTrackWithBty`, which is
    // "active platform admin OR active Foundry Host" -- strictly MORE authority-aware, not less.
    // This asserts the shared capability rule by name so a future narrowing to a bare table read,
    // or a quiet removal, both fail here.
    const src = read("src/app/api/bty/teams/invoke/route.ts");
    expect(src).toContain("canTrackWithBty");
  });
});
