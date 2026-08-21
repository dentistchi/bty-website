/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clearAllDeviceDrafts, DEVICE_DRAFT_KEY_PREFIX } from "./device-draft-store";

/**
 * R4-R5C4A-R1 — signing out must end device-local drafts on this browser.
 *
 * The seam is real and specific: the participant cookie is HttpOnly and survives sign-out, and
 * a participant with no auth session stays compatible by design, so a signed-out browser can
 * still resolve the previous learner and receive their namespace.
 */

const K = (ns: string) => `${DEVICE_DRAFT_KEY_PREFIX}${ns}`;

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("T1 — sign-out clears every device-local draft", () => {
  it("removes ALL draft keys, not just one participant's", () => {
    window.localStorage.setItem(K("nsAAAAAAAAAAAAAAAAAAAA"), '{"version":1}');
    window.localStorage.setItem(K("nsBBBBBBBBBBBBBBBBBBBB"), '{"version":1}');
    window.localStorage.setItem(K("nsCCCCCCCCCCCCCCCCCCCC"), '{"version":1}');
    clearAllDeviceDrafts();
    expect(window.localStorage.getItem(K("nsAAAAAAAAAAAAAAAAAAAA"))).toBeNull();
    expect(window.localStorage.getItem(K("nsBBBBBBBBBBBBBBBBBBBB"))).toBeNull();
    expect(window.localStorage.getItem(K("nsCCCCCCCCCCCCCCCCCCCC"))).toBeNull();
  });

  it("removing many does not skip any — the collect-then-delete order matters", () => {
    // Deleting while iterating re-indexes the store and leaves survivors. 40 keys makes that
    // failure certain rather than occasional, so this test cannot pass by luck.
    for (let i = 0; i < 40; i += 1) window.localStorage.setItem(K(`ns${i}`), '{"version":1}');
    clearAllDeviceDrafts();
    const left = Object.keys(window.localStorage).filter((k) => k.startsWith(DEVICE_DRAFT_KEY_PREFIX));
    expect(left).toEqual([]);
  });
});

describe("T2 — nothing else on the device is touched", () => {
  it("the other draft families and ordinary product state all survive", () => {
    const keep: Record<string, string> = {
      // Measured neighbours — the two OTHER device-draft families, plus ordinary state.
      "bty_program_proposal_v2:abc": "host module proposal",
      "bty-arena-action-draft:xyz": "arena action draft",
      btyArenaState: "v1",
      "btyArenaState:v1": "arena session",
      "assessment.answers.v1": "assessment",
      "dojo.result.v1": "dojo",
      bty_onboarding_role_v1: "onboarding",
      bty_last_visit: "2026-08-21",
      theme: "dark",
      "sb-mveycersmqfiuddslnrj-auth-token": "supabase",
      // A near-miss that must NOT be swept: same words, different prefix.
      "bty.fr.draft.v2:ns": "a future version",
      "bty-fr-draft-v1:ns": "hyphens, not dots",
    };
    for (const [k, v] of Object.entries(keep)) window.localStorage.setItem(k, v);
    window.localStorage.setItem(K("nsAAAAAAAAAAAAAAAAAAAA"), "a real draft");

    clearAllDeviceDrafts();

    expect(window.localStorage.getItem(K("nsAAAAAAAAAAAAAAAAAAAA"))).toBeNull();
    for (const [k, v] of Object.entries(keep)) {
      expect(window.localStorage.getItem(k), `${k} must survive`).toBe(v);
    }
  });
});

describe("T3 — a refusing store must never block signing out", () => {
  it("throwing localStorage access does not throw", () => {
    const spy = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => clearAllDeviceDrafts()).not.toThrow();
    spy.mockRestore();
  });

  it("throwing removeItem does not throw, and still clears what it can", () => {
    window.localStorage.setItem(K("stubborn"), "x");
    window.localStorage.setItem(K("fine"), "y");
    let first = true;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, k: string) {
      if (first) {
        first = false;
        throw new DOMException("SecurityError");
      }
      Object.getPrototypeOf(Object.getPrototypeOf(this)); // no-op, keeps `this` used
      delete (this as unknown as Record<string, unknown>)[k];
    });
    expect(() => clearAllDeviceDrafts()).not.toThrow();
  });

  it("no draft key or value is ever logged", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/bty/foundry/device-draft-store.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/console\.|analytics|track\(|fetch\(/);
  });
});

describe("T4/T7 — the sign-out path and its containment", () => {
  const acct = readFileSync(join(process.cwd(), "src/lib/native/accountSession.ts"), "utf8");
  const code = acct.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("T4 — signOutAccount purges, so A's draft is gone before B can enter any room", () => {
    expect(code).toContain("clearAllDeviceDrafts()");
    // It sits INSIDE signOutAccount, after the teardown.
    const fn = code.slice(code.indexOf("export async function signOutAccount"));
    expect(fn).toContain("clearAllDeviceDrafts()");
  });

  it("purges only AFTER the server layer succeeded — a failed sign-out destroys nothing", () => {
    const fn = code.slice(code.indexOf("export async function signOutAccount"));
    expect(fn.indexOf('failed.includes("server")')).toBeLessThan(fn.indexOf("clearAllDeviceDrafts()"));
  });

  it("…and BEFORE the navigation that ends the page", () => {
    const fn = code.slice(code.indexOf("export async function signOutAccount"));
    expect(fn.indexOf("clearAllDeviceDrafts()")).toBeLessThan(fn.indexOf("window.location.assign"));
  });

  it("T7 — no cookie, participant, namespace, TTL or server behaviour changed", () => {
    // The purge is the ONLY thing this repair adds to the sign-out path.
    expect(code).not.toMatch(/document\.cookie|bty_fr_ps_|Clear-Site-Data/);
    // Comments stripped: the store's own header EXPLAINS the participant cookie seam, so a
    // whole-file match would flag the paragraph that documents why the purge exists.
    const store = readFileSync(join(process.cwd(), "src/lib/bty/foundry/device-draft-store.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(store).not.toMatch(/fetch\(|supabase|document\.cookie/i);
    // The room's own contract is untouched: same prefix, one definition.
    const hook = readFileSync(join(process.cwd(), "src/app/f/[token]/useDeviceDraft.ts"), "utf8");
    expect(hook).toContain("DEVICE_DRAFT_KEY_PREFIX");
    expect(hook).not.toMatch(/"bty\.fr\.draft\.v1:"/); // prefix is owned in ONE place
  });

  it("the OTHER JS-reachable sign-out purges too", () => {
    const btn = readFileSync(join(process.cwd(), "src/components/auth/LogoutButton.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(btn).toContain("clearAllDeviceDrafts()");
    // …before it hands the browser to the login page.
    expect(btn.indexOf("clearAllDeviceDrafts()")).toBeLessThan(btn.indexOf("window.location.assign"));
  });

  it("T5 — nothing else calls the purge, so ordinary room use never triggers it", () => {
    const hook = readFileSync(join(process.cwd(), "src/app/f/[token]/useDeviceDraft.ts"), "utf8");
    expect(hook).not.toContain("clearAllDeviceDrafts");
    for (const f of ["FoundryJoinClient.tsx", "FoundryDocumentClient.tsx", "FoundryGuidanceClient.tsx"]) {
      const c = readFileSync(join(process.cwd(), "src/app/f/[token]", f), "utf8");
      expect(c, f).not.toContain("clearAllDeviceDrafts");
    }
  });
});
