import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdmin = vi.fn();
const syncMicrosoftManagers = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/foundry/events/microsoftManagerSync.server", () => ({
  syncMicrosoftManagers: (...args: unknown[]) => syncMicrosoftManagers(...args),
}));

describe("POST /api/bty/admin/microsoft-manager-sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getSupabaseAdmin.mockReturnValue({ service: true });
    syncMicrosoftManagers.mockResolvedValue({ ok: true, complete: true, examined: 0 });
    process.env.MICROSOFT_MANAGER_SYNC_SECRET = "0123456789abcdef";
  });

  it("requires the exact operator secret and calls the server-only sync", async () => {
    const { POST } = await import("./route");
    const denied = await POST(new Request("https://example.test", { method: "POST" }) as never);
    expect(denied.status).toBe(401);
    const allowed = await POST(new Request("https://example.test", { method: "POST", headers: { "x-bty-sync-secret": "0123456789abcdef" } }) as never);
    expect(allowed.status).toBe(200);
    expect(syncMicrosoftManagers).toHaveBeenCalledWith({ service: true });
  });
});
