/**
 * The Teams deep-link target — the grammar that decides what a `subPageId` may mean.
 * Slice Teams-Native Delivery V1.
 *
 * A deep link is attacker-craftable, so the security property proved here is a property of the
 * GRAMMAR rather than a promise about a caller: there is exactly one target kind, its payload is
 * the existing signed room token, and everything else is null.
 */
import { describe, it, expect } from "vitest";
import {
  BTY_TEAMS_APP_ID,
  BTY_TEAMS_PERSONAL_TAB_ENTITY_ID,
  buildTrainingDeepLink,
  buildTrainingInviteMessage,
  buildTrainingTarget,
  joinTokenFromParticipantUrl,
  parseTrainingFromSearch,
  parseTrainingTarget,
} from "./trainingTarget";

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";
const ORIGIN = "https://arena.btydaily.com";

describe("the target round-trips, and only for a real room token", () => {
  it("builds and parses the one approved shape", () => {
    const target = buildTrainingTarget(TOKEN)!;
    expect(target).toBe(`foundry-training:${TOKEN}`);
    expect(parseTrainingTarget(target)).toEqual({ kind: "foundry-training", joinToken: TOKEN });
  });

  it("refuses to MINT a target for anything that is not a Foundry room token", () => {
    for (const bad of ["", "   ", "abc", "btyev1.a.b", "aalo1.a.b", "btyfr1.a", "btyfr1..b", TOKEN + " x"]) {
      expect(buildTrainingTarget(bad), bad).toBeNull();
    }
  });
});

describe("a forged subPageId cannot become arbitrary internal navigation", () => {
  it("rejects every shape that is not exactly foundry-training:<room token>", () => {
    const forged = [
      "/en/app",
      "//evil.example/app",
      "https://evil.example/f/btyfr1.a.b",
      "javascript:alert(1)",
      "foundry-training:",
      "foundry-training:../../admin",
      "foundry-training:/en/admin",
      "foundry-training:btyfr1.a.b/../../x",
      "foundry-training:btyfr1.a.b?next=/admin",
      "foundry-training:btyfr1.a.b#/admin",
      "FOUNDRY-TRAINING:" + TOKEN,
      "xfoundry-training:" + TOKEN,
      `foundry-training:${TOKEN}&extra=1`,
      "conversations",
      "btyHome",
      JSON.stringify({ subEntityId: `foundry-training:${TOKEN}` }),
    ];
    for (const raw of forged) expect(parseTrainingTarget(raw), raw).toBeNull();
  });

  it("rejects non-strings, and anything absurdly long", () => {
    for (const raw of [null, undefined, 7, {}, [], true, "foundry-training:btyfr1." + "a".repeat(2000) + ".b"]) {
      expect(parseTrainingTarget(raw)).toBeNull();
    }
  });

  it("names a room and nothing else — no event id, no user, no route, no authority", () => {
    const parsed = parseTrainingTarget(`foundry-training:${TOKEN}`)!;
    expect(Object.keys(parsed).sort()).toEqual(["joinToken", "kind"]);
  });
});

describe("the deep link addresses the BTY PERSONAL TAB, never the web room", () => {
  it("is the documented entity shape for this app and tab", () => {
    const link = buildTrainingDeepLink({ joinToken: TOKEN, title: "Morning Office Opening", origin: ORIGIN })!;
    const url = new URL(link);
    expect(url.origin).toBe("https://teams.microsoft.com");
    expect(url.pathname).toBe(`/l/entity/${BTY_TEAMS_APP_ID}/${BTY_TEAMS_PERSONAL_TAB_ENTITY_ID}`);
    expect(url.searchParams.get("label")).toBe("Morning Office Opening");
    expect(url.searchParams.get("openInMeeting")).toBe("false");
    expect(JSON.parse(url.searchParams.get("context")!)).toEqual({
      subEntityId: `foundry-training:${TOKEN}`,
    });
  });

  it("★ the webUrl fallback is SELF-CONTAINED: the TAB, carrying the same signed target", () => {
    /*
      MEASURED ON A REAL IPHONE (Slice Teams iOS webUrl Fallback): Teams iOS opened the BTY app
      full-screen from `webUrl` and supplied no `subPageId` at all, so a bare `/teams` fallback
      opened BTY and forgot which training. The fallback now names the training too.
    */
    const url = new URL(buildTrainingDeepLink({ joinToken: TOKEN, title: "T", origin: ORIGIN })!);
    const webUrl = new URL(url.searchParams.get("webUrl")!);
    expect(webUrl.origin + webUrl.pathname).toBe(`${ORIGIN}/teams`);
    expect(webUrl.searchParams.get("training")).toBe(`foundry-training:${TOKEN}`);
    // It is the SAME capability the context carries, not a second one.
    expect(webUrl.searchParams.get("training")).toBe(
      JSON.parse(url.searchParams.get("context")!).subEntityId,
    );
    // And still never the public web room.
    expect(url.searchParams.get("webUrl")).not.toMatch(/\/f\//);
  });

  it("refuses a bad token or a non-https origin rather than emitting a broken link", () => {
    expect(buildTrainingDeepLink({ joinToken: "nope", title: "T", origin: ORIGIN })).toBeNull();
    expect(buildTrainingDeepLink({ joinToken: TOKEN, title: "T", origin: "http://x.test" })).toBeNull();
    expect(buildTrainingDeepLink({ joinToken: TOKEN, title: "T", origin: "" })).toBeNull();
  });
});

describe("the invitation a Host sends carries the deep link and NEVER a raw /f/ URL", () => {
  const deepLink = buildTrainingDeepLink({ joinToken: TOKEN, title: "Morning Office Opening", origin: ORIGIN })!;

  it("names the host, the training, and the way in", () => {
    const msg = buildTrainingInviteMessage({
      hostName: "Hanbit",
      title: "Morning Office Opening",
      deepLink,
      locale: "en",
    });
    expect(msg).toContain("Hanbit shared training with you:");
    expect(msg).toContain("Morning Office Opening");
    expect(msg).toContain(deepLink);
    // THE ACCEPTANCE CONDITION: no web room URL in a message composed inside Teams.
    expect(msg).not.toMatch(/\/f\/btyfr1/);
    expect(msg).not.toMatch(/arena\.btydaily\.com\/f\//);
  });

  it("works without a host name, and in Korean", () => {
    const en = buildTrainingInviteMessage({ hostName: null, title: "T", deepLink, locale: "en" });
    expect(en).toContain("Training shared with you:");
    const ko = buildTrainingInviteMessage({ hostName: "한빛", title: "아침 준비", deepLink, locale: "ko" });
    expect(ko).toContain("한빛님이 훈련을 공유했습니다:");
    expect(ko).toContain("BTY에서 열기:");
    expect(ko).not.toMatch(/\/f\/btyfr1/);
  });
});

describe("the join token is read back out of the canonical room URL", () => {
  it("reads the token a control room holds", () => {
    expect(joinTokenFromParticipantUrl(`${ORIGIN}/f/${TOKEN}`)).toBe(TOKEN);
    expect(joinTokenFromParticipantUrl(`${ORIGIN}/f/${TOKEN}/`)).toBe(TOKEN);
  });

  it("refuses anything that is not a Foundry room URL", () => {
    for (const bad of [
      `${ORIGIN}/f/not-a-token`,
      `${ORIGIN}/teams`,
      `${ORIGIN}/f/${TOKEN}/extra`,
      `${ORIGIN}/en/app`,
      "not a url",
      null,
      undefined,
      42,
    ]) {
      expect(joinTokenFromParticipantUrl(bad), String(bad)).toBeNull();
    }
  });
});

describe("the query transport is the same grammar, read back", () => {
  it("reads a valid target out of a /teams search string", () => {
    const encoded = encodeURIComponent(`foundry-training:${TOKEN}`);
    expect(parseTrainingFromSearch(`?training=${encoded}`)).toEqual({
      kind: "foundry-training",
      joinToken: TOKEN,
    });
    // Unencoded and alongside other parameters both work.
    expect(parseTrainingFromSearch(`training=foundry-training:${TOKEN}`)?.joinToken).toBe(TOKEN);
    expect(parseTrainingFromSearch(`?diag=1&training=${encoded}&x=2`)?.joinToken).toBe(TOKEN);
  });

  it("refuses everything the context transport refuses — one grammar, two transports", () => {
    for (const bad of [
      "",
      "?",
      "?training=",
      "?training=/en/app",
      "?training=conversations",
      "?training=foundry-training:",
      "?training=foundry-training:../../admin",
      "?training=foundry-training:not-a-token",
      `?training=${encodeURIComponent("https://evil.example/f/btyfr1.a.b")}`,
      `?other=${encodeURIComponent(`foundry-training:${TOKEN}`)}`,
      null,
      undefined,
    ]) {
      expect(parseTrainingFromSearch(bad), String(bad)).toBeNull();
    }
  });

  it("cannot smuggle an event id, a user or a path — the grammar has no room for them", () => {
    for (const bad of [
      "?training=foundry-training:11111111-1111-4111-8111-111111111111",
      "?training=foundry-training:user-A",
      `?training=foundry-training:${TOKEN}&userId=user-B`,
    ]) {
      const parsed = parseTrainingFromSearch(bad);
      if (parsed) expect(Object.keys(parsed).sort()).toEqual(["joinToken", "kind"]);
    }
    expect(parseTrainingFromSearch("?training=foundry-training:user-A")).toBeNull();
  });
});
