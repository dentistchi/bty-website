import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

/**
 * R4-R4B-R1N-R1-R1 — THE COOKIE AND THE REDIRECT ARE ONE RESPONSE.
 *
 * The previous attempt wrote `NEXT_LOCALE` from `document.cookie` in the language link's onClick,
 * immediately before a full-page navigation. Every test passed; the device failed — choose Korean,
 * terminate, reopen in English. jsdom has one synchronous cookie store, so nothing in a unit test
 * could have caught it, and this repository had already measured the real behaviour twice: a
 * JS-store write is not the reliable direction for the hosted WKWebView, and WebKit flushes that
 * store to disk asynchronously.
 *
 * These tests assert the property that makes the race impossible: the `Set-Cookie` travels on the
 * SAME response that performs the navigation.
 */

const ORIGIN = "https://arena.btydaily.com";
const call = (qs: string) => GET(new NextRequest(`${ORIGIN}/api/locale/set${qs}`));
const setCookie = (r: Response) => r.headers.get("set-cookie") ?? "";

describe("R4-R4B-R1N-R1-R1 · 1/2/3/4 · the cookie the server writes", () => {
  it("1 — to=ko sets NEXT_LOCALE=ko", async () => {
    expect(setCookie(await call("?to=ko&next=%2Fko%2Fapp"))).toContain("NEXT_LOCALE=ko");
  });

  it("2 — to=en sets NEXT_LOCALE=en", async () => {
    expect(setCookie(await call("?to=en&next=%2Fen%2Fapp"))).toContain("NEXT_LOCALE=en");
  });

  it("3 — Path=/, Max-Age=31536000, SameSite=Lax, Secure", async () => {
    const c = setCookie(await call("?to=ko&next=%2Fko%2Fapp")).toLowerCase();
    expect(c).toContain("path=/");
    expect(c).toContain("max-age=31536000");
    expect(c).toContain("samesite=lax");
    expect(c).toContain("secure");
  });

  it("4 — it is NOT HttpOnly, because /start reads it in the browser", async () => {
    expect(setCookie(await call("?to=ko&next=%2Fko%2Fapp")).toLowerCase()).not.toContain("httponly");
  });

  it("13 — exactly ONE cookie is set, and it is not an auth cookie", async () => {
    const c = setCookie(await call("?to=ko&next=%2Fko%2Fapp"));
    // Counting `NEXT_LOCALE=` rather than splitting on "," — a Set-Cookie date legitimately
    // contains commas, so the split would have been a false signal either way.
    expect((c.match(/NEXT_LOCALE=/g) ?? []).length).toBe(1);
    expect(c).not.toMatch(/sb-|access_token|refresh_token|NEXT_LOCALE_OLD/);
  });
});

describe("R4-R4B-R1N-R1-R1 · C · one response does both", () => {
  it("the redirect and the Set-Cookie are on the SAME response", async () => {
    const r = await call("?to=ko&next=%2Fko%2Fapp");
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(`${ORIGIN}/ko/app`);
    expect(setCookie(r)).toContain("NEXT_LOCALE=ko");
  });

  it("the response is never cached", async () => {
    const r = await call("?to=en&next=%2Fen%2Fapp");
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
});

describe("R4-R4B-R1N-R1-R1 · 5 · an unrecognised language writes nothing", () => {
  for (const bad of ["kr", "EN", "fr", "", "ko-KR", "en;ko"]) {
    it(`to=${JSON.stringify(bad)} → 400 and no cookie`, async () => {
      const r = await call(`?to=${encodeURIComponent(bad)}&next=%2Fko%2Fapp`);
      expect(r.status).toBe(400);
      // Writing a default here would record a preference nobody expressed — for a year.
      expect(setCookie(r)).toBe("");
    });
  }

  it("a missing `to` is refused too", async () => {
    const r = await call("?next=%2Fko%2Fapp");
    expect(r.status).toBe(400);
    expect(setCookie(r)).toBe("");
  });
});

describe("R4-R4B-R1N-R1-R1 · 6/7 · the redirect cannot leave this origin", () => {
  const HOSTILE = [
    "https://evil.example.com/steal",
    "//evil.example.com/steal",
    "http:/\/evil.example.com",
    "javascript:alert(1)",
    "\\\\evil.example.com",
    "/\\evil.example.com",
  ];

  for (const next of HOSTILE) {
    it(`rejects ${JSON.stringify(next).slice(0, 34)}`, async () => {
      const r = await call(`?to=ko&next=${encodeURIComponent(next)}`);
      const loc = r.headers.get("location") ?? "";
      expect(loc.startsWith(`${ORIGIN}/`), `escaped to ${loc}`).toBe(true);
      expect(loc).not.toContain("evil.example.com");
      expect(loc).not.toContain("javascript:");
      // Even a rejected target still lands them in the language they asked for.
      expect(loc).toBe(`${ORIGIN}/ko/bty`);
      expect(setCookie(r)).toContain("NEXT_LOCALE=ko");
    });
  }

  it("a login target is refused, so a language switch cannot create a login loop", async () => {
    const r = await call("?to=ko&next=%2Fko%2Fbty%2Flogin");
    expect(r.headers.get("location")).toBe(`${ORIGIN}/ko/bty`);
  });
});

describe("R4-R4B-R1N-R1-R1 · 8 · a legitimate switch keeps where you were", () => {
  it("the query string survives", async () => {
    const r = await call(`?to=ko&next=${encodeURIComponent("/ko/app?tab=me")}`);
    expect(r.headers.get("location")).toBe(`${ORIGIN}/ko/app?tab=me`);
  });

  it("a deep in-app path survives", async () => {
    const r = await call(`?to=en&next=${encodeURIComponent("/en/app?tab=learn&x=1")}`);
    expect(r.headers.get("location")).toBe(`${ORIGIN}/en/app?tab=learn&x=1`);
  });
});

describe("R4-R4B-R1N-R1-R1 · 14 · it writes no data", () => {
  it("the route touches no database, session or storage", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/api/locale/set/route.ts", "utf8");
    /*
      Asserting on API USE, not on the substring "auth" — the route legitimately imports the shared
      safe-redirect primitive from `@/lib/auth/sanitize-next-for-redirect`, which is exactly the
      reuse this slice was asked for. A blanket substring ban would have forbidden the right thing.
    */
    for (const forbidden of ["supabase", "getSupabase", ".insert(", ".update(", ".rpc(", "getUser(", "signOut", "auth.", "cookies().delete"]) {
      expect(src, `route must not use ${forbidden}`).not.toContain(forbidden);
    }
    // The ONLY cookie it names is the preference.
    const names = [...src.matchAll(/name:\s*([A-Za-z_]+)/g)].map((m) => m[1]);
    expect(names).toEqual(["LOCALE_COOKIE"]);
  });
});

/**
 * ★ mode=json — THE SAME WRITE, WITHOUT THE MOVE.
 *
 * Inside a Teams tab the redirect is the defect: `/teams` opens any href that leaves the frame in
 * a real browser, so a language link took the Founder's iPhone out of Teams entirely. This mode
 * lets the control `fetch` the writer instead of following it. The point of these tests is that it
 * is the SAME cookie — a second response shape, never a second writer.
 */
describe("★ mode=json · the non-navigating shape of the one writer", () => {
  it("it does not redirect, and says plainly that it worked", async () => {
    const res = await call("?to=ko&mode=json");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    await expect(res.json()).resolves.toMatchObject({ ok: true, locale: "ko" });
  });

  it("★ the cookie is byte-identical to the redirecting form — one writer, two shapes", async () => {
    const strip = (c: string) => c.replace(/expires=[^;]+;?\s*/i, "").toLowerCase();
    const viaJson = strip(setCookie(await call("?to=ko&mode=json")));
    const viaRedirect = strip(setCookie(await call("?to=ko&next=%2Fteams%3Ftab%3Dme")));
    expect(viaJson).toBe(viaRedirect);
    expect(viaJson).toContain("next_locale=ko");
  });

  it("an unrecognised language still writes NOTHING, in either shape", async () => {
    for (const qs of ["?to=fr&mode=json", "?to=&mode=json", "?mode=json"]) {
      const res = await call(qs);
      expect(res.status, qs).toBe(400);
      expect(setCookie(res), qs).not.toContain("NEXT_LOCALE");
    }
  });

  it("it is not cached — a stale 200 would be a language change that never happened", async () => {
    expect((await call("?to=en&mode=json")).headers.get("cache-control")).toBe("no-store");
  });

  it("★ every OTHER caller is untouched: no mode ⇒ still a 303 to the sanitised destination", async () => {
    const res = await call("?to=ko&next=%2Fteams%3Ftab%3Dme");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/teams?tab=me`);
  });

  it("an unknown mode is not a magic word — it redirects, like anything else", async () => {
    expect((await call("?to=ko&mode=xml&next=%2Fko%2Fapp")).status).toBe(303);
  });
});
