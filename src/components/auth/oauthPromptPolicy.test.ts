import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * R4-R4B-R2 — THE ACCOUNT CHOOSER IS FOR SWITCHING, NOT FOR SIGNING IN.
 *
 * `prompt: "select_account"` was sent on EVERY web sign-in. Its own comment explained it as a
 * LOGOUT concern — "an active Google SSO session re-authenticates silently right after logout" —
 * and then applied it universally, so every returning user was pushed through a full interactive
 * chooser and Google emailed them "You shared some Google Account data with BTY" each time.
 *
 * `forceAccountSelection` already existed on the component, was already set from `?switch=1`, and
 * the NATIVE branch already honoured it. Only the web branch ignored the prop it was handed.
 *
 * These are source assertions on purpose: the property that matters is that NO web call site can
 * send the prompt unconditionally, which is a statement about every branch rather than about one
 * rendered outcome.
 */

const CARD = readFileSync("src/components/auth/login-card.tsx", "utf8");
const OAUTH = readFileSync("src/lib/native/googleOAuth.ts", "utf8");
const ACCOUNT_BLOCK = readFileSync("src/components/app-shell/AccountBlock.tsx", "utf8");

/** Every line that actually SENDS the prompt (comments and docs excluded). */
function promptSendingLines(src: string): string[] {
  return src
    .split("\n")
    .filter((l) => l.includes('prompt: "select_account"'))
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//"));
}

describe("R4-R4B-R2 · 5/6 · no web call site sends the chooser unconditionally", () => {
  for (const [name, src] of [["login-card", CARD], ["googleOAuth", OAUTH]] as const) {
    it(`${name}: every send is guarded by forceAccountSelection`, () => {
      const lines = promptSendingLines(src);
      expect(lines.length, `${name} should still send it on an explicit switch`).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line, `unconditional prompt in ${name}: ${line}`).toContain("forceAccountSelection ?");
      }
    });
  }

  it("6 — normal sign-in sends no queryParams at all", () => {
    // The spread collapses to {} when the flag is false — not to a prompt with another value.
    for (const src of [CARD, OAUTH]) {
      for (const line of promptSendingLines(src)) {
        expect(line).toMatch(/\.\.\.\(forceAccountSelection \? \{ queryParams: \{ prompt: "select_account" \} \} : \{\}\)/);
      }
    }
  });

  it("9 — the NATIVE plugin branch is untouched and still conditional", () => {
    // login-card:254 — the id-token path, which was already correct before this slice.
    expect(CARD).toContain('...(forceAccountSelection ? { forceAccountSelection: true } : {})');
  });

  it("scopes are unchanged", () => {
    // Nothing in this slice touches what BTY asks Google for.
    expect(CARD).not.toMatch(/scopes:\s*\[/);
    expect(OAUTH).not.toMatch(/scopes:\s*\[/);
  });
});

describe("R4-R4B-R2 · 5/8 · an explicit switch still forces the chooser", () => {
  it("8 — AccountBlock's Switch account passes forceAccountSelection", () => {
    expect(ACCOUNT_BLOCK).toContain("forceAccountSelection: true");
  });

  it("the login route still forwards ?switch=1 into the card", () => {
    const loginClient = readFileSync("src/app/[locale]/bty/(public)/login/LoginClient.tsx", "utf8");
    expect(loginClient).toContain("forceAccountSelection={accountSwitch}");
  });
});

describe("R4-R4B-R2 · 4/7 · switch-account suppresses restore on BOTH platforms", () => {
  const LOGIN_CLIENT = readFileSync("src/app/[locale]/bty/(public)/login/LoginClient.tsx", "utf8");

  it("4 — the restore effect returns early on an account switch, before any platform check", () => {
    const effect = LOGIN_CLIENT.slice(LOGIN_CLIENT.indexOf("const [nativeRestoring"));
    const guard = effect.indexOf("if (accountSwitch) return;");
    const native = effect.indexOf("isNative()");
    expect(guard).toBeGreaterThan(-1);
    // The switch guard must come FIRST — otherwise a web switch would restore the old account.
    expect(guard).toBeLessThan(native);
  });

  it("7 — the platform check no longer short-circuits web out of restoring", () => {
    // The old `if (!isNative()) return;` is what sent web users to Google.
    expect(LOGIN_CLIENT).not.toContain("if (!isNative()) return;");
    expect(LOGIN_CLIENT).toContain("restoreWebSession");
    expect(LOGIN_CLIENT).toContain("restoreNativeSession");
  });
});
