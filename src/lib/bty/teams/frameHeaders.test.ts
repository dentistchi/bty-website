import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

/**
 * The framing policy, asserted as a contract (Slice A0).
 *
 * The Teams tab needs exactly one exception to a rule the rest of the product depends on. Both
 * halves fail silently when broken: a lost `X-Frame-Options: DENY` on a normal route is an
 * invisible clickjacking surface, and an accidental `DENY` on `/teams` blanks the tab on device
 * with nothing logged.
 *
 * The specific trap this file exists for: Next.js applies EVERY matching header rule, not only
 * the first. A global `/:path*` rule alongside a `/teams` rule would re-attach `DENY` to the tab,
 * and reading the config would not reveal it — which is why the exclusion is a negative lookahead
 * and why it is asserted here by actually matching paths against the patterns.
 */

const require_ = createRequire(import.meta.url);
const nextConfig = require_("../../../../next.config.js") as {
  headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
};

/** Turn a Next.js `source` pattern into a matcher, covering both `:param*` and raw regex forms. */
function matches(source: string, pathname: string): boolean {
  const pattern = source
    .replace(/\/:path\*/g, "(?:/.*)?")
    .replace(/\/:path(?!\*)/g, "/[^/]+")
    .replace(/\/:\w+\(([^)]+)\)/g, "/(?:$1)");
  return new RegExp(`^${pattern}$`).test(pathname);
}

async function headersFor(pathname: string): Promise<Record<string, string>> {
  const rules = await nextConfig.headers();
  const out: Record<string, string> = {};
  for (const rule of rules) {
    if (!matches(rule.source, pathname)) continue;
    for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}

const TEAMS_PATHS = ["/teams", "/teams/link", "/teams/link/done"];
const PROTECTED_PATHS = ["/", "/en/app", "/ko/app", "/en/bty/login", "/api/version", "/start", "/f/token"];

describe("the Teams tab is framable by Microsoft, and only by Microsoft", () => {
  it("emits frame-ancestors and NO X-Frame-Options", async () => {
    for (const p of TEAMS_PATHS) {
      const h = await headersFor(p);
      // XFO has no allow-list and would override the CSP, so it must be absent here.
      expect(h["x-frame-options"], `path ${p}`).toBeUndefined();
      expect(h["content-security-policy"], `path ${p}`).toContain("frame-ancestors");
      expect(h["content-security-policy"]).toContain("https://teams.microsoft.com");
    }
  });

  it("never allows a wildcard or a non-Microsoft host", async () => {
    /*
      An explicit allow-list rather than a regex. `teams.cloud.microsoft` is a real Microsoft host
      whose TLD *is* `.microsoft`, so a pattern loose enough to admit it is loose enough to admit
      things it should not. Enumerating the permitted suffixes says exactly what is allowed, and a
      new one has to be added here deliberately.
    */
    const PERMITTED_SUFFIXES = [
      "teams.microsoft.com",
      "cloud.microsoft",
      "skype.com",
      "microsoft.com",
      "office.com",
    ];
    const csp = (await headersFor("/teams"))["content-security-policy"] ?? "";
    const sources = csp.replace("frame-ancestors", "").trim().split(/\s+/);
    expect(sources).not.toContain("*");
    expect(sources).not.toContain("https:");
    for (const s of sources) {
      if (s === "'self'") continue;
      expect(s.startsWith("https://"), `frame-ancestors source ${s} is not https`).toBe(true);
      const host = s.slice("https://".length).replace(/^\*\./, "");
      const ok = PERMITTED_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
      expect(ok, `frame-ancestors source ${s} is not a permitted Microsoft host`).toBe(true);
    }
  });
});

describe("every other route keeps DENY — the exception is the size of the tab", () => {
  it("still sends X-Frame-Options: DENY and frame-ancestors 'none'", async () => {
    for (const p of PROTECTED_PATHS) {
      const h = await headersFor(p);
      expect(h["x-frame-options"], `path ${p}`).toBe("DENY");
      expect(h["content-security-policy"], `path ${p}`).toBe("frame-ancestors 'none'");
    }
  });

  it("no DENY rule matches /teams, because Next.js applies every matching rule", async () => {
    // If an exclusion regressed, the tab would receive DENY in addition to its own CSP — and would
    // blank on device while every other check still looked green. The in-shell app has its own
    // DENY rule (AI Patient Practice V1), so EVERY rule carrying X-Frame-Options is checked.
    const rules = await nextConfig.headers();
    const denyRules = rules.filter((r) => r.headers.some((h) => h.key === "X-Frame-Options"));
    expect(denyRules.length).toBeGreaterThan(0);
    for (const p of TEAMS_PATHS) {
      for (const r of denyRules) expect(matches(r.source, p), `DENY rule ${r.source} must not match ${p}`).toBe(false);
    }
    for (const p of PROTECTED_PATHS) {
      expect(denyRules.some((r) => matches(r.source, p)), `some DENY rule must match ${p}`).toBe(true);
    }
  });

  it("keeps the other shared security headers on every path, tab included", async () => {
    for (const p of [...TEAMS_PATHS, ...PROTECTED_PATHS]) {
      const h = await headersFor(p);
      expect(h["x-content-type-options"], `path ${p}`).toBe("nosniff");
      expect(h["referrer-policy"], `path ${p}`).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"], `path ${p}`).toContain("camera=()");
    }
  });
});

describe("the microphone is granted to BTY only where Practice runs (AI Patient Practice V1)", () => {
  const MIC_PATHS = ["/teams", "/teams/link", "/en/app", "/ko/app"];
  const MIC_OFF_PATHS = ["/", "/en/bty/login", "/api/version", "/start", "/f/token", "/en/app/extra", "/en/apple", "/fr/app"];

  it("allows microphone=(self) — never a third party — on the Teams tab and the in-shell app", async () => {
    for (const p of MIC_PATHS) {
      const pp = (await headersFor(p))["permissions-policy"] ?? "";
      expect(pp, `path ${p}`).toContain("microphone=(self)");
      expect(pp, `path ${p}`).toContain("camera=()");
      expect(pp, `path ${p}`).toContain("geolocation=()");
      expect(pp, `path ${p}`).not.toMatch(/microphone=\*|microphone=\([^)]*https?:/);
    }
  });

  it("keeps the microphone off everywhere else", async () => {
    for (const p of MIC_OFF_PATHS) {
      expect((await headersFor(p))["permissions-policy"], `path ${p}`).toBe("camera=(), microphone=(), geolocation=()");
    }
  });

  it("gives every path one Permissions-Policy VALUE, so no rule silently overrides another", async () => {
    // `/teams/:path*` also matches `/teams` (zero segments), so the tab legitimately receives the
    // same header from two rules. What must never happen is two DIFFERENT values for one path.
    const rules = await nextConfig.headers();
    for (const p of [...MIC_PATHS, ...MIC_OFF_PATHS, ...TEAMS_PATHS, ...PROTECTED_PATHS]) {
      const values = rules.filter((r) => matches(r.source, p)).flatMap((r) => r.headers.filter((h) => h.key === "Permissions-Policy").map((h) => h.value));
      expect(new Set(values).size, `path ${p} has conflicting Permissions-Policy values: ${values.join(" | ")}`).toBe(1);
    }
  });
});
