/**
 * The people picker's three fields, and the one rule about them.
 * Slice Teams-Native Delivery V1.
 */
import { describe, it, expect } from "vitest";
import { canComposeChat, readTeamsSelection } from "./peopleSelection";

const OID_A = "8f4c1e2a-0000-4000-8000-000000000001";
const OID_B = "8f4c1e2a-0000-4000-8000-000000000002";

describe("the Entra object id is the coordinate; the address is only transport", () => {
  it("keeps the three lists separate and in picker order", () => {
    const sel = readTeamsSelection([
      { objectId: OID_A, displayName: "Ari Kim", email: "ari@contoso.com" },
      { objectId: OID_B, displayName: "Bo Lee", email: "bo@contoso.com" },
    ]);
    expect(sel.entraIds).toEqual([OID_A, OID_B]);
    expect(sel.chatTargets).toEqual(["ari@contoso.com", "bo@contoso.com"]);
    expect(sel.displayNames).toEqual(["Ari Kim", "Bo Lee"]);
  });

  it("DROPS a person with no Entra id — an address alone is not someone BTY can name", () => {
    const sel = readTeamsSelection([
      { displayName: "No Id", email: "ghost@contoso.com" },
      { objectId: OID_A, email: "ari@contoso.com" },
    ]);
    expect(sel.entraIds).toEqual([OID_A]);
    expect(sel.chatTargets).toEqual(["ari@contoso.com"]);
  });

  it("de-duplicates by the coordinate, not by name or address", () => {
    const sel = readTeamsSelection([
      { objectId: OID_A, displayName: "Ari", email: "ari@contoso.com" },
      { objectId: OID_A, displayName: "Ari Kim", email: "ari.kim@contoso.com" },
    ]);
    expect(sel.entraIds).toEqual([OID_A]);
    expect(sel.chatTargets).toEqual(["ari@contoso.com"]);
  });

  it("refuses a display name masquerading as an address", () => {
    const sel = readTeamsSelection([{ objectId: OID_A, displayName: "Ari Kim", email: "Ari Kim" }]);
    expect(sel.entraIds).toEqual([OID_A]);
    expect(sel.chatTargets).toEqual([]);
    expect(canComposeChat(sel)).toBe(false);
  });

  it("survives junk without throwing, and yields nothing usable", () => {
    for (const junk of [null, undefined, 0, "people", {}, [null, 3, "x", {}]]) {
      const sel = readTeamsSelection(junk);
      expect(sel.entraIds).toEqual([]);
      expect(canComposeChat(sel)).toBe(false);
    }
  });

  it("a selection with coordinates but no address cannot compose a chat — and says so", () => {
    const sel = readTeamsSelection([{ objectId: OID_A }]);
    expect(sel.entraIds).toEqual([OID_A]);
    expect(canComposeChat(sel)).toBe(false);
  });
});
