import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Track with BTY at the ROUTE, for a platform admin who holds no Foundry Host grant.
 *
 * ★ THE PRODUCTION FAILURE THIS CLOSES (2026-09-02, hc@bty-dso.com):
 *   "Tracking isn't available on your BTY account."
 *
 * The gate asked exactly one question — `isActiveFoundryHost` — and hc had no grant row, so an
 * account the Founder considers a platform admin was refused before the People Picker was drawn
 * and before the message or its attachment was ever inspected.
 *
 * These tests drive the real route with a mocked database, so they prove the DEPLOYED predicate,
 * not just the pure function. Both gates are covered: the dialog (`fetchTask`, which exposes the
 * People Picker and the tracking target) and the submit (which writes).
 */

const verifyBotFrameworkToken = vi.fn();
const resolveBtyUserFromMicrosoftIdentity = vi.fn();
const ensureActionCapture = vi.fn();
const rpc = vi.fn();
const isActiveFoundryHost = vi.fn();
const adminGrantRow = vi.fn();

vi.mock("@/lib/bty/teams/botTokenVerifier.server", () => ({ verifyBotFrameworkToken }));
vi.mock("@/lib/bty/identity-link/microsoftIdentityLink.server", () => ({ resolveBtyUserFromMicrosoftIdentity }));
vi.mock("@/lib/bty/action-capture/ensureActionCapture.server", () => ({ ensureActionCapture }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({
  isActiveFoundryHost: (...a: unknown[]) => isActiveFoundryHost(...a),
}));
// The real `canTrackWithBty` runs; only the database under it is a double.
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    rpc,
    from: (table: string) => ({
      select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => adminGrantRow(table, id) }) }),
    }),
  }),
}));

const TID = "11111111-1111-1111-1111-111111111111";
const OID = "22222222-2222-2222-2222-222222222222";
/** hc — a platform admin with NO foundry_host_grants row. */
const ADMIN = "18b1ee80-0000-0000-0000-000000000001";
const A = "33333333-3333-3333-3333-333333333333";
const B = "44444444-4444-4444-4444-444444444444";

/** A Teams message that carries a FILE — the exact shape the Founder tracked from. */
function fileMessagePayload() {
  return {
    id: "m-file-1",
    body: { content: "<p>Handover checklist attached</p>" },
    linkToMessage: "https://teams.microsoft.com/l/message/19:chan@thread.tacv2/m-file-1",
    attachments: [
      {
        id: "att-1",
        name: "handover-checklist.pdf",
        contentType: "application/vnd.microsoft.teams.file.download.info",
        contentUrl: "https://bty.sharepoint.com/sites/x/Shared%20Documents/handover-checklist.pdf",
      },
    ],
  };
}

function activity(over: Record<string, unknown> = {}, value: Record<string, unknown> = {}) {
  return {
    name: "composeExtension/submitAction",
    channelData: { tenant: { id: TID } },
    from: { id: "29:addr", aadObjectId: OID },
    conversation: { id: "19:chan@thread.tacv2" },
    value: {
      commandId: "trackWithBty",
      messagePayload: fileMessagePayload(),
      ...value,
    },
    ...over,
  };
}

const req = (body: unknown) =>
  new NextRequest("https://arena.btydaily.com/api/bty/teams/invoke", {
    method: "POST",
    headers: { authorization: "Bearer x", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function POST(r: NextRequest) {
  const mod = await import("@/app/api/bty/teams/invoke/route");
  return mod.POST(r);
}

const REFUSAL = "Tracking isn't available on your BTY account.";
const text = async (res: Response) => JSON.stringify(await res.json());

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: {} });
  resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "RESOLVED", userId: ADMIN });
  ensureActionCapture.mockResolvedValue({ ok: true, created: true, capture: { id: "cap-1" } });
  rpc.mockResolvedValue({ data: [{ announcement_id: "ann-1", resolved_count: 2, already_existed: false }], error: null });
  // The defect's exact condition: no Host grant anywhere.
  isActiveFoundryHost.mockResolvedValue(false);
  adminGrantRow.mockResolvedValue({ data: { status: "active" }, error: null });
});

describe("★ an active platform admin with NO Host grant", () => {
  it("★ 1. passes the PRE-PICKER gate and receives the People Picker", async () => {
    const res = await POST(req(activity({ name: "composeExtension/fetchTask" })));
    const body = await res.json();
    expect(body.task?.value?.card?.content).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain(REFUSAL);
    expect(isActiveFoundryHost).not.toHaveBeenCalled(); // admin short-circuits
  });

  it("★ 2. passes the SUBMIT gate and the tracking record is created", async () => {
    const res = await POST(req(activity({}, { data: { hostFraming: "Please confirm", recipients: `${A},${B}` } })));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "bty_track_announcement",
      expect.objectContaining({ p_owner_user_id: ADMIN, p_source_capture_id: "cap-1" }),
    );
    expect(await text(res)).not.toContain(REFUSAL);
  });

  it("★ 3. the admin lookup asks ONLY the platform-admin table", async () => {
    await POST(req(activity({ name: "composeExtension/fetchTask" })));
    expect(adminGrantRow).toHaveBeenCalledWith("bty_platform_admin_grants", ADMIN);
  });

  it("★ 4. opening the dialog still writes nothing", async () => {
    await POST(req(activity({ name: "composeExtension/fetchTask" })));
    expect(ensureActionCapture).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("★ the file-containing message the Founder actually tracked", () => {
  it("★ 5. a message with a file attachment reaches the tracking flow and succeeds", async () => {
    const res = await POST(req(activity({}, { data: { hostFraming: "Read this before Friday", recipients: A } })));
    expect(res.status).toBe(200);
    expect(await text(res)).not.toContain(REFUSAL);
  });

  it("★ 6. exactly ONE tracking record is created for one submit", async () => {
    await POST(req(activity({}, { data: { hostFraming: "Read this", recipients: A } })));
    expect(rpc.mock.calls.filter((c) => c[0] === "bty_track_announcement")).toHaveLength(1);
    expect(ensureActionCapture).toHaveBeenCalledTimes(1);
  });

  it("★ 7. the Teams source link is preserved on the capture", async () => {
    await POST(req(activity({}, { data: { hostFraming: "Read this", recipients: A } })));
    const arg = ensureActionCapture.mock.calls[0][1] as Record<string, unknown>;
    expect(JSON.stringify(arg)).toContain("teams.microsoft.com/l/message");
  });

  it("★ 8. a repeat submit is IDEMPOTENT — the same run, not a second one", async () => {
    rpc.mockResolvedValue({ data: [{ announcement_id: "ann-1", resolved_count: 2, already_existed: true }], error: null });
    ensureActionCapture.mockResolvedValue({ ok: true, created: false, capture: { id: "cap-1" } });
    const a = await POST(req(activity({}, { data: { hostFraming: "Read this", recipients: A } })));
    const b = await POST(req(activity({}, { data: { hostFraming: "Read this", recipients: A } })));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const ids = rpc.mock.calls.filter((c) => c[0] === "bty_track_announcement");
    expect(ids).toHaveLength(2); // two calls...
    expect(ids[0][1].p_source_capture_id).toBe(ids[1][1].p_source_capture_id); // ...one capture
  });

  it("★ 9. NO BINARY, AND NO ATTACHMENT METADATA — the MESSAGE is what is tracked", async () => {
    await POST(req(activity({}, { data: { hostFraming: "Read this", recipients: A } })));
    const arg = JSON.stringify(ensureActionCapture.mock.calls[0][1]);

    // Measured, so the product contract is stated rather than assumed: the invoke parser reads
    // exactly `preview_text` (from the HTML body) and `source_url` (linkToMessage). It never
    // touches `payload.attachments`, and `bty_action_captures` has no attachment column, no
    // storage reference and no binary column.
    expect(arg).toContain("preview_text");
    expect(arg).toContain("source_url");

    // No bytes, by construction.
    expect(arg).not.toContain("base64");
    expect(arg).not.toContain("contentBytes");

    // ...and no attachment metadata either. If a future slice starts capturing the filename or
    // content type, this fails and the contract gets restated deliberately rather than drifting.
    expect(arg).not.toContain("handover-checklist.pdf");
    expect(arg).not.toContain("attachments");
    expect(arg).not.toContain("sharepoint");
  });
});

describe("★ everyone else is still refused, at BOTH gates", () => {
  it("★ 10. an ordinary participant is refused BEFORE the picker is drawn", async () => {
    adminGrantRow.mockResolvedValue({ data: null, error: null });
    isActiveFoundryHost.mockResolvedValue(false);
    const res = await POST(req(activity({ name: "composeExtension/fetchTask" })));
    const body = await text(res);
    expect(body).toContain(REFUSAL);
    expect(body).not.toContain("Data.Query"); // no People Picker dataset reached them
  });

  it("★ 11. an ordinary participant's forged SUBMIT writes nothing", async () => {
    adminGrantRow.mockResolvedValue({ data: null, error: null });
    isActiveFoundryHost.mockResolvedValue(false);
    const res = await POST(req(activity({}, { data: { hostFraming: "x", recipients: A } })));
    expect(await text(res)).toContain(REFUSAL);
    expect(ensureActionCapture).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("★ 12. a REVOKED admin is refused", async () => {
    adminGrantRow.mockResolvedValue({ data: { status: "revoked" }, error: null });
    isActiveFoundryHost.mockResolvedValue(false);
    expect(await text(await POST(req(activity({ name: "composeExtension/fetchTask" }))))).toContain(REFUSAL);
  });

  it("★ 13. a revoked admin who IS independently a Host still tracks", async () => {
    adminGrantRow.mockResolvedValue({ data: { status: "revoked" }, error: null });
    isActiveFoundryHost.mockResolvedValue(true);
    expect(await text(await POST(req(activity({ name: "composeExtension/fetchTask" }))))).not.toContain(REFUSAL);
  });

  it("★ 14. a manual Host with no admin grant still tracks", async () => {
    adminGrantRow.mockResolvedValue({ data: null, error: null });
    isActiveFoundryHost.mockResolvedValue(true);
    expect(await text(await POST(req(activity({ name: "composeExtension/fetchTask" }))))).not.toContain(REFUSAL);
  });

  it("★ 15. a database failure on the admin lookup FAILS CLOSED for a non-host", async () => {
    adminGrantRow.mockRejectedValue(new Error("connection reset"));
    isActiveFoundryHost.mockResolvedValue(false);
    expect(await text(await POST(req(activity({ name: "composeExtension/fetchTask" }))))).toContain(REFUSAL);
  });

  it("★ 16. an UNRESOLVED Teams identity never reaches the capability gate at all", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "NOT_LINKED", userId: null });
    const res = await POST(req(activity({ name: "composeExtension/fetchTask" })));
    expect(adminGrantRow).not.toHaveBeenCalled();
    expect(await text(res)).not.toContain("Data.Query");
  });
});

describe("★ Save to BTY is untouched by any of this", () => {
  it("Save still captures for a NON-admin, NON-host participant", async () => {
    adminGrantRow.mockResolvedValue({ data: null, error: null });
    isActiveFoundryHost.mockResolvedValue(false);
    const res = await POST(req(activity({}, { commandId: "saveToBty", data: {} })));
    expect(await text(res)).not.toContain(REFUSAL);
    expect(ensureActionCapture).toHaveBeenCalled();
  });

  it("Save never consults the platform-admin table", async () => {
    adminGrantRow.mockResolvedValue({ data: null, error: null });
    isActiveFoundryHost.mockResolvedValue(false);
    await POST(req(activity({}, { commandId: "saveToBty", data: {} })));
    expect(adminGrantRow).not.toHaveBeenCalled();
  });
});
