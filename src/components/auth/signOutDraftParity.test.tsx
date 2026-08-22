/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import PrivacyAwareLogoutLink from "./PrivacyAwareLogoutLink";
import { DEVICE_DRAFT_KEY_PREFIX } from "@/lib/bty/foundry/device-draft-store";

/**
 * R4-R5C4A-R2 — PARITY. Every explicit Sign out ends this device's unfinished drafts.
 *
 * The two JS sign-outs already did (R1). These two reach the same `/bty/logout` route as
 * ordinary links, and that route is middleware-only: it clears cookies and leaves localStorage
 * alone. The repair adds the purge WITHOUT taking over navigation, so what must be proven is
 * both halves — the drafts go, and the link is still a link.
 */

vi.mock("next/link", () => ({
  default: ({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) => (
    // next/link renders an anchor; this keeps href/onClick/class/style observable in jsdom.
    <a {...(rest as Record<string, unknown>)}>{children}</a>
  ),
}));

const K = (ns: string) => `${DEVICE_DRAFT_KEY_PREFIX}${ns}`;
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the shared link purges without taking over navigation", () => {
  it("an ordinary click removes every draft", () => {
    window.localStorage.setItem(K("nsA"), '{"version":1}');
    window.localStorage.setItem(K("nsB"), '{"version":1}');
    render(<PrivacyAwareLogoutLink href="/en/bty/logout">Sign out</PrivacyAwareLogoutLink>);
    fireEvent.click(screen.getByText("Sign out"));
    expect(window.localStorage.getItem(K("nsA"))).toBeNull();
    expect(window.localStorage.getItem(K("nsB"))).toBeNull();
  });

  it("T9 — it stays an anchor: same href, same label, same class and style", () => {
    render(
      <PrivacyAwareLogoutLink href="/ko/bty/logout?next=/ko/bty/login" className="bty-nav-link" style={{ color: "red" }}>
        로그아웃
      </PrivacyAwareLogoutLink>,
    );
    const a = screen.getByText("로그아웃");
    expect(a.tagName).toBe("A");
    expect(a.getAttribute("href")).toBe("/ko/bty/logout?next=/ko/bty/login");
    expect(a.getAttribute("class")).toBe("bty-nav-link");
    expect((a as HTMLElement).style.color).toBe("red");
  });

  it("navigation is never intercepted — the click is not defaultPrevented", () => {
    render(<PrivacyAwareLogoutLink href="/en/bty/logout">Sign out</PrivacyAwareLogoutLink>);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByText("Sign out").dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("a modified click purges too, and still opens normally", () => {
    window.localStorage.setItem(K("nsA"), '{"version":1}');
    render(<PrivacyAwareLogoutLink href="/en/bty/logout">Sign out</PrivacyAwareLogoutLink>);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true });
    screen.getByText("Sign out").dispatchEvent(ev);
    expect(window.localStorage.getItem(K("nsA"))).toBeNull();
    expect(ev.defaultPrevented).toBe(false);
  });

  it("T3 — a throwing store does not throw and does not cancel navigation", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    render(<PrivacyAwareLogoutLink href="/en/bty/logout">Sign out</PrivacyAwareLogoutLink>);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    expect(() => screen.getByText("Sign out").dispatchEvent(ev)).not.toThrow();
    expect(ev.defaultPrevented).toBe(false);
  });

  it("T4 — unrelated device state survives", () => {
    const keep = {
      "bty_program_proposal_v2:x": "host proposal",
      "bty-arena-action-draft:y": "arena draft",
      "btyArenaState:v1": "arena",
      theme: "dark",
    };
    for (const [k, v] of Object.entries(keep)) window.localStorage.setItem(k, v);
    window.localStorage.setItem(K("nsA"), "draft");
    render(<PrivacyAwareLogoutLink href="/en/bty/logout">Sign out</PrivacyAwareLogoutLink>);
    fireEvent.click(screen.getByText("Sign out"));
    expect(window.localStorage.getItem(K("nsA"))).toBeNull();
    for (const [k, v] of Object.entries(keep)) expect(window.localStorage.getItem(k), k).toBe(v);
  });
});

describe("T1/T2 — exactly the two residual surfaces were repaired", () => {
  it("T1 — BtyTopNav signs out through the shared link, on the same href", () => {
    const c = strip(read("src/components/bty/BtyTopNav.tsx"));
    expect(c).toContain("<PrivacyAwareLogoutLink href={logout}");
    expect(c).toContain("const logout = `/${locale}/bty/logout?next=/${locale}/bty/login`;");
    // The shared helper still serves every OTHER nav item and gained no logout side effect.
    expect(c).toContain("const link = (href: string, label: string");
    expect(c).not.toMatch(/clearAllDeviceDrafts/);
    expect(c).toContain("{link(arenaHref,");
    expect(c).toContain("{link(dash, ");
  });

  it("T2 — my-page/account signs out through the shared link, on the same href", () => {
    const c = strip(read("src/app/[locale]/my-page/account/AccountPageClient.tsx"));
    expect(c).toContain("<PrivacyAwareLogoutLink");
    expect(c).toContain("href={`/${locale}/bty/logout`}");
    expect(c).toContain("{labels.signOut}");
  });

  it("T6 — no anchor elsewhere was swept up, and no purge was duplicated", () => {
    // Only the two named surfaces + the component itself may reference it.
    const users = ["src/components/bty/BtyTopNav.tsx", "src/app/[locale]/my-page/account/AccountPageClient.tsx"];
    for (const f of users) expect(strip(read(f))).toContain("PrivacyAwareLogoutLink");
    // The prefix still has exactly ONE definition.
    const store = read("src/lib/bty/foundry/device-draft-store.ts");
    expect(store).toContain('export const DEVICE_DRAFT_KEY_PREFIX = "bty.fr.draft.v1:"');
    const comp = strip(read("src/components/auth/PrivacyAwareLogoutLink.tsx"));
    expect(comp).not.toMatch(/bty\.fr\.draft/); // imports the purge, never restates the prefix
    expect(comp).toContain("clearAllDeviceDrafts");
  });
});

describe("T5/T7/T8 — nothing else moved", () => {
  it("T5 — both JS sign-outs remain covered", () => {
    expect(strip(read("src/lib/native/accountSession.ts"))).toContain("clearAllDeviceDrafts()");
    expect(strip(read("src/components/auth/LogoutButton.tsx"))).toContain("clearAllDeviceDrafts()");
  });

  it("T7 — middleware, the logout API route and participant cookie logic are untouched", () => {
    const mw = read("src/middleware.ts");
    expect(mw).toContain('res.headers.set("Clear-Site-Data", \'"cookies"\');');
    expect(strip(mw)).not.toMatch(/clearAllDeviceDrafts|bty\.fr\.draft/);
    const api = read("src/app/api/auth/logout/route.ts");
    expect(strip(api)).not.toMatch(/clearAllDeviceDrafts|bty\.fr\.draft/);
    expect(api).toContain("supabase.auth.signOut()");
    // The participant session model is not part of this repair.
    expect(strip(read("src/lib/bty/foundry/events/participant-session.ts"))).not.toMatch(/draft/i);
  });

  it("T8 — no broad storage wipe was introduced anywhere", () => {
    for (const f of ["src/middleware.ts", "src/app/api/auth/logout/route.ts", "src/components/auth/PrivacyAwareLogoutLink.tsx"]) {
      expect(read(f), f).not.toMatch(/Clear-Site-Data[^\n]*storage/i);
    }
    // …and the purge is still prefix-scoped, never a blanket clear().
    expect(strip(read("src/lib/bty/foundry/device-draft-store.ts"))).not.toMatch(/localStorage\.clear\(\)|\bs\.clear\(\)/);
  });
});
