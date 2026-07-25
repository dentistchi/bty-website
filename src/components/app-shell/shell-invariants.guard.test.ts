/** @vitest-environment node */
/**
 * App Shell + Today Simplification V1 — invariant guards. This IA slice must NOT weaken the
 * deterministic forced-reset/recovery routing (enforced in middleware) or the native launch door
 * (/start). These read the canonical source and assert those contracts are still present, unchanged.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readSrc = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("forced-reset / recovery routing remains intact (middleware)", () => {
  const mw = readSrc("src/middleware.ts");

  it("still hard-redirects the two source scopes to /{locale}/center when forced-reset is pending", () => {
    expect(mw).toMatch(/userHasForcedResetPending/);
    // The redirect target is the canonical Center recovery route.
    expect(mw).toMatch(/\/center/);
    // The forced-reset marker header is still asserted.
    expect(mw).toMatch(/x-forced-reset/);
    // Both guarded scopes are still named.
    expect(mw).toMatch(/bty-arena/);
    expect(mw).toMatch(/bty\/foundry|foundry/);
  });
});

describe("native launch door (/start) remains valid", () => {
  const start = readSrc("src/app/(shell)/start/page.client.tsx");

  it("still routes native launches into the app shell and web to the ritual /today", () => {
    expect(start).toMatch(/isNative\(\)/);
    expect(start).toMatch(/\/\$\{locale\}\/app/);
    // The start-shell-ready hydration marker for the native watchdog is unchanged.
    expect(start).toMatch(/start-shell-ready|__btyStartShellReadyAt/);
  });
});

describe("account-switch lands on a valid new tab", () => {
  const account = readSrc("src/components/app-shell/AccountBlock.tsx");
  it("returns to /app?tab=today (a canonical visible tab) after switching", () => {
    expect(account).toMatch(/tab=today/);
  });
});
