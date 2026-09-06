import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE TRACK CONVERSATION ROUTE — what the boundary refuses.
 *
 * ★ WHERE AUTHORITY IS DECIDED. Not here. `bty_resolve_announcement_thread_role` joins the
 * recipient row to its announcement owner in SQL and answers HOST, RECIPIENT or `none`. What these
 * tests hold is that the route hands that decision the SESSION user and nothing else, that it never
 * reads a role or an author from a request, and that a refusal is shaped so it cannot be used to
 * discover that somebody else's conversation exists.
 */

const requireUser = vi.fn();
const unauthenticated = vi.fn(
  () => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
);
const readThread = vi.fn();
const postThreadMessage = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (req: unknown) => requireUser(req),
  unauthenticated: () => unauthenticated(),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ __admin: true }) }));
vi.mock("@/lib/bty/announcement/announcementThread.server", () => ({
  readThread: (a: unknown, p: unknown) => readThread(a, p),
  postThreadMessage: (a: unknown, p: unknown) => postThreadMessage(a, p),
}));

const HOST = "18b1ee80-0000-0000-0000-000000000001";
const OTHER = "617f7cea-0000-0000-0000-000000000002";
const ROW_A = "1a5d1547-0000-0000-0000-00000000000a";
const ROW_B = "1a5d1547-0000-0000-0000-00000000000b";

const ROUTE = "src/app/api/bty/announcements/recipients/[recipientId]/thread/route.ts";
const url = (id: string) => `https://arena.btydaily.com/api/bty/announcements/recipients/${id}/thread`;

async function GET(id = ROW_A) {
  const mod = await import("@/app/api/bty/announcements/recipients/[recipientId]/thread/route");
  return mod.GET(new NextRequest(url(id)), { params: Promise.resolve({ recipientId: id }) });
}

async function POST(body: unknown, id = ROW_A) {
  const mod = await import("@/app/api/bty/announcements/recipients/[recipientId]/thread/route");
  const req = new NextRequest(url(id), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return mod.POST(req, { params: Promise.resolve({ recipientId: id }) });
}

const signedIn = (id: string) => requireUser.mockResolvedValue({ user: { id }, base: new Response("{}") });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  signedIn(HOST);
  readThread.mockResolvedValue({ ok: true, role: "HOST", messages: [] });
  postThreadMessage.mockResolvedValue({ ok: true, role: "HOST", messageId: "m-1", duplicate: false });
});

/* ─────────────────────────  6. UNAUTHENTICATED  ───────────────────────── */

describe("★ 6 — no session is 401, on BOTH verbs, before anything is touched", () => {
  it("GET refuses with 401 and reaches no service", async () => {
    requireUser.mockResolvedValue({ user: null, base: new Response("{}") });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(readThread).not.toHaveBeenCalled();
  });

  it("POST refuses with 401 and writes nothing", async () => {
    requireUser.mockResolvedValue({ user: null, base: new Response("{}") });
    const res = await POST({ body: "hello" });
    expect(res.status).toBe(401);
    expect(postThreadMessage).not.toHaveBeenCalled();
  });
});

/* ────────────────────────  THE ACTOR IS THE SESSION  ──────────────────────── */

describe("★ the actor is always the session user, and the body cannot choose one", () => {
  it("GET passes the session id and the path recipient, and nothing else", async () => {
    await GET(ROW_A);
    expect(readThread).toHaveBeenCalledWith({ __admin: true }, { recipientId: ROW_A, actorUserId: HOST });
  });

  it("★ POST ignores every identity, role and target a crafted body carries", async () => {
    await POST({
      body: "hello",
      clientMessageId: "n1",
      // Everything a forged request would try. None of it is read.
      actorUserId: OTHER,
      userId: OTHER,
      authorUserId: OTHER,
      authorRole: "HOST",
      role: "HOST",
      recipientId: ROW_B,
      announcementId: "ann-2",
      ownerUserId: OTHER,
    });
    const passed = postThreadMessage.mock.calls[0][1] as Record<string, unknown>;
    expect(passed.actorUserId).toBe(HOST);
    expect(passed.recipientId).toBe(ROW_A);
    // ★ Exactly four fields cross this boundary. A role is not one of them.
    expect(Object.keys(passed).sort()).toEqual(["actorUserId", "body", "clientMessageId", "recipientId"]);
  });

  it("the recipient comes from the PATH, so a body cannot redirect a message to another person", async () => {
    await POST({ body: "hi", recipientId: ROW_B }, ROW_A);
    expect((postThreadMessage.mock.calls[0][1] as { recipientId: string }).recipientId).toBe(ROW_A);
  });

  it("a malformed body is an empty message rather than a crash", async () => {
    const mod = await import("@/app/api/bty/announcements/recipients/[recipientId]/thread/route");
    const req = new NextRequest(url(ROW_A), { method: "POST", body: "not json" });
    postThreadMessage.mockResolvedValue({ ok: false, reason: "empty_message" });
    const res = await mod.POST(req, { params: Promise.resolve({ recipientId: ROW_A }) });
    expect(res.status).toBe(400);
  });
});

/* ───────────────────────────  REFUSAL SHAPE  ─────────────────────────── */

describe("★ 3-5 — a refusal cannot be told apart from a thread that does not exist", () => {
  it("GET on a thread the caller is not a party to is 404", async () => {
    readThread.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await GET(ROW_B);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "not_found" });
  });

  it("POST into a thread the caller is not a party to is 404, with the identical body", async () => {
    postThreadMessage.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await POST({ body: "let me in" }, ROW_B);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "not_found" });
  });

  it("★ an arbitrary uuid produces exactly the same answer as a real refusal", async () => {
    readThread.mockResolvedValue({ ok: false, reason: "not_found" });
    const guessed = await GET("00000000-0000-0000-0000-000000000000");
    const refused = await GET(ROW_B);
    expect(guessed.status).toBe(refused.status);
    expect(await guessed.json()).toEqual(await refused.json());
  });

  it("a real server fault is 500 and is NOT dressed up as not_found", async () => {
    readThread.mockResolvedValue({ ok: false, reason: "failed" });
    expect((await GET()).status).toBe(500);
  });
});

/* ────────────────────────  MESSAGE VALIDITY / IDEMPOTENCY  ──────────────────────── */

describe("★ 10, 13 — refusals and duplicates", () => {
  it("empty is 400 and too long is 400", async () => {
    postThreadMessage.mockResolvedValue({ ok: false, reason: "empty_message" });
    expect((await POST({ body: "   " })).status).toBe(400);
    postThreadMessage.mockResolvedValue({ ok: false, reason: "message_too_long" });
    expect((await POST({ body: "x".repeat(1001) })).status).toBe(400);
  });

  it("★ a duplicate is a 200 and says so — the thing the person said is in the thread, once", async () => {
    postThreadMessage.mockResolvedValue({ ok: true, role: "RECIPIENT", messageId: "m-1", duplicate: true });
    const res = await POST({ body: "sent twice", clientMessageId: "n1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, messageId: "m-1", role: "RECIPIENT", duplicate: true });
  });

  it("the nonce reaches the service verbatim so the SAME words carry the SAME key", async () => {
    await POST({ body: "hi", clientMessageId: "nonce-abc" });
    expect((postThreadMessage.mock.calls[0][1] as { clientMessageId: unknown }).clientMessageId).toBe("nonce-abc");
  });
});

/* ─────────────────────────  APPEND-ONLY SURFACE  ───────────────────────── */

describe("★ 8-9 — the route offers no way to change or remove a message", () => {
  const src = readFileSync(join(process.cwd(), ROUTE), "utf8");

  it("exports GET and POST and nothing else", () => {
    expect(src).toContain("export async function GET");
    expect(src).toContain("export async function POST");
    for (const verb of ["export async function PATCH", "export async function PUT", "export async function DELETE"]) {
      expect(src, verb).not.toContain(verb);
    }
  });

  it("★ it is addressed by a RECIPIENT, never by an announcement — that IS the privacy model", () => {
    expect(ROUTE).toContain("recipients/[recipientId]/thread");
    expect(src).not.toMatch(/params:\s*Promise<\{\s*(id|announcementId)/);
  });

  it("never reads a role, an author or a user id out of the request", () => {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const f of ["authorRole", "author_user_id", "ownerUserId", "announcementId"]) {
      expect(code, f).not.toContain(f);
    }
    // The only identity in the file is the session user's.
    expect(code).toContain("actorUserId: user.id");
  });

  it("no response is cacheable — a private conversation must not sit in a shared cache", () => {
    expect((src.match(/private, no-store/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});

/* ─────────────────────────  NON-REGRESSION  ───────────────────────── */

describe("★ the sibling Track routes are untouched by this addition", () => {
  it("the thread lives beside handle and notify, under the SAME dynamic segment they already use", () => {
    // opennextjs-cloudflare shadows a route nested under a dynamic SIBLING. `thread` is a static
    // segment under the same `[recipientId]` that `handle` and `notify` already resolve under, so
    // it takes the shape that is already proven in production rather than a new one.
    for (const sibling of ["handle", "notify"]) {
      const p = join(process.cwd(), `src/app/api/bty/announcements/recipients/[recipientId]/${sibling}/route.ts`);
      expect(readFileSync(p, "utf8")).toContain("export async function POST");
    }
  });
});
