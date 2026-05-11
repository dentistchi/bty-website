import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimitKV, getCfClientIp } from "./rate-limit";

const mockKVStore = new Map<string, string>();
const mockKV = {
  get: vi.fn(async (key: string) => mockKVStore.get(key) ?? null),
  put: vi.fn(async (key: string, value: string) => {
    mockKVStore.set(key, value);
  }),
  delete: vi.fn(async (key: string) => {
    mockKVStore.delete(key);
  }),
};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: { RATE_LIMIT_KV: mockKV },
  }),
}));

describe("rateLimitKV", () => {
  beforeEach(() => {
    mockKVStore.clear();
    vi.clearAllMocks();
  });

  it("allows requests under limit", async () => {
    for (let i = 0; i < 5; i++) {
      const result = await rateLimitKV({
        endpoint: "login",
        identifier: "192.0.2.1",
        limit: 5,
        windowSeconds: 900,
      });
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks request at limit+1 with valid retryAfter", async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimitKV({
        endpoint: "login",
        identifier: "192.0.2.1",
        limit: 5,
        windowSeconds: 900,
      });
    }
    const result = await rateLimitKV({
      endpoint: "login",
      identifier: "192.0.2.1",
      limit: 5,
      windowSeconds: 900,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(900);
    }
  });

  it("hashes identifier (no PII in KV key)", async () => {
    await rateLimitKV({
      endpoint: "send-reset-email",
      identifier: "user@example.com",
      limit: 3,
      windowSeconds: 3600,
    });
    const keys = Array.from(mockKVStore.keys());
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^rl:auth:send-reset-email:[0-9a-f]{16}$/);
    expect(keys[0]).not.toContain("user@example.com");
  });

  it("isolates different endpoints", async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimitKV({
        endpoint: "login",
        identifier: "192.0.2.1",
        limit: 5,
        windowSeconds: 900,
      });
    }
    const registerResult = await rateLimitKV({
      endpoint: "register",
      identifier: "192.0.2.1",
      limit: 3,
      windowSeconds: 3600,
    });
    expect(registerResult.allowed).toBe(true);
  });

  it("isolates different identifiers", async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimitKV({
        endpoint: "login",
        identifier: "192.0.2.1",
        limit: 5,
        windowSeconds: 900,
      });
    }
    const otherIp = await rateLimitKV({
      endpoint: "login",
      identifier: "192.0.2.2",
      limit: 5,
      windowSeconds: 900,
    });
    expect(otherIp.allowed).toBe(true);
  });
});

describe("auth endpoint rate-limit integration (Step 4 endpoint config)", () => {
  beforeEach(() => {
    mockKVStore.clear();
    vi.clearAllMocks();
  });

  it("login pattern: 5 IP attempts allowed, 6th blocked with retryAfter ≤ 900", async () => {
    const opts = {
      endpoint: "login",
      identifier: "192.0.2.10",
      limit: 5,
      windowSeconds: 900,
    } as const;
    for (let i = 0; i < 5; i++) {
      const r = await rateLimitKV(opts);
      expect(r.allowed).toBe(true);
    }
    const blocked = await rateLimitKV(opts);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(900);
    }
  });

  it("register pattern: 3 IP attempts allowed, 4th blocked with retryAfter ≤ 3600", async () => {
    const opts = {
      endpoint: "register",
      identifier: "192.0.2.11",
      limit: 3,
      windowSeconds: 3600,
    } as const;
    for (let i = 0; i < 3; i++) {
      const r = await rateLimitKV(opts);
      expect(r.allowed).toBe(true);
    }
    const blocked = await rateLimitKV(opts);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(3600);
    }
  });

  it("send-reset-email pattern: 3 same-email attempts allowed, 4th blocked", async () => {
    const opts = {
      endpoint: "send-reset-email",
      identifier: "user@example.com",
      limit: 3,
      windowSeconds: 3600,
    } as const;
    for (let i = 0; i < 3; i++) {
      const r = await rateLimitKV(opts);
      expect(r.allowed).toBe(true);
    }
    const blocked = await rateLimitKV(opts);
    expect(blocked.allowed).toBe(false);
  });

  it("send-reset-email: different emails isolated", async () => {
    const opts1 = {
      endpoint: "send-reset-email",
      identifier: "a@example.com",
      limit: 3,
      windowSeconds: 3600,
    } as const;
    for (let i = 0; i < 3; i++) {
      await rateLimitKV(opts1);
    }
    const blockedFirst = await rateLimitKV(opts1);
    expect(blockedFirst.allowed).toBe(false);

    const otherEmail = await rateLimitKV({
      endpoint: "send-reset-email",
      identifier: "b@example.com",
      limit: 3,
      windowSeconds: 3600,
    });
    expect(otherEmail.allowed).toBe(true);
  });

  it("login: different IPs isolated", async () => {
    const ip1 = {
      endpoint: "login",
      identifier: "203.0.113.5",
      limit: 5,
      windowSeconds: 900,
    } as const;
    for (let i = 0; i < 5; i++) {
      await rateLimitKV(ip1);
    }
    const blockedFirst = await rateLimitKV(ip1);
    expect(blockedFirst.allowed).toBe(false);

    const ip2 = await rateLimitKV({
      endpoint: "login",
      identifier: "203.0.113.6",
      limit: 5,
      windowSeconds: 900,
    });
    expect(ip2.allowed).toBe(true);
  });
});

describe("rateLimitKV — env-aware fail policy (KV missing)", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.BTY_ENV;
    vi.resetModules();
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => {
        throw new Error("no cloudflare context");
      },
    }));
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BTY_ENV;
    } else {
      process.env.BTY_ENV = originalEnv;
    }
    vi.doUnmock("@opennextjs/cloudflare");
  });

  it("fails closed in staging (BTY_ENV=staging)", async () => {
    process.env.BTY_ENV = "staging";
    const { rateLimitKV: fn } = await import("./rate-limit");
    const result = await fn({
      endpoint: "login",
      identifier: "192.0.2.1",
      limit: 5,
      windowSeconds: 900,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBe(60);
    }
  });

  it("fails open in local dev (BTY_ENV unset)", async () => {
    delete process.env.BTY_ENV;
    const { rateLimitKV: fn } = await import("./rate-limit");
    const result = await fn({
      endpoint: "login",
      identifier: "192.0.2.1",
      limit: 5,
      windowSeconds: 900,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("getCfClientIp", () => {
  it("prefers cf-connecting-ip", () => {
    const req = new Request("http://localhost", {
      headers: {
        "cf-connecting-ip": "203.0.113.1",
        "x-forwarded-for": "192.0.2.1",
      },
    });
    expect(getCfClientIp(req)).toBe("203.0.113.1");
  });

  it("falls back to x-forwarded-for first hop", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.0.2.1, 10.0.0.1" },
    });
    expect(getCfClientIp(req)).toBe("192.0.2.1");
  });

  it("returns anonymous when no headers", () => {
    const req = new Request("http://localhost");
    expect(getCfClientIp(req)).toBe("anonymous");
  });
});
