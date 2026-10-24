import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requirePlatformAdmin, isActivePlatformAdmin } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { authorCases, createPilot, mutatePilot, publicDiscoveryCase, readOwnPilot, reviewPilots } from "@/lib/bty/clinical-pilot/service.server";
import { checkDiscoveryModel } from "@/lib/bty/clinical-pilot/model-check.server";

const text = z.string().max(10000);
const identity = { traceId: z.string().uuid(), requestId: z.string().uuid() };
const observed = { expectedEventCount: z.number().int().min(1).max(10000) };
const answers = z.object({ evaluation: text, diagnosis: text, plan: text, rationale: text }).strict();
const inputSchema = z.discriminatedUnion("operation", [
  z.object({ ...identity, operation: z.literal("start"), caseId: z.string().max(80), caseVersion: z.string().max(80) }).strict(),
  z.object({ ...identity, operation: z.literal("save"), answers }).strict(),
  z.object({ ...identity, operation: z.literal("submit"), answers }).strict(),
  z.object({ ...identity, ...observed, operation: z.literal("message"), text: z.string().min(1).max(2000), channel: z.enum(["patient", "exam"]) }).strict(),
  z.object({ ...identity, ...observed, operation: z.literal("decision"), text }).strict(),
  z.object({ ...identity, ...observed, operation: z.literal("conclude"), text }).strict(),
  z.object({ ...identity, operation: z.literal("react"), reaction: z.object({ helpful: z.enum(["yes", "partly", "no"]), comment: text, revisedPlan: text }).strict() }).strict(),
]);
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (e: unknown) => {
  const code = e instanceof Error ? e.message : "UNAVAILABLE";
  const status = code === "NOT_FOUND" ? 404 : ["IMMUTABLE", "CONFLICT"].includes(code) ? 409
    : ["INVALID_CASE", "REASONING_REQUIRED", "WRONG_FLOW", "TEXT_REQUIRED", "ENCOUNTER_LIMIT", "CASE_VERSION_CHANGED"].includes(code) ? 400 : 503;
  return reply({ ok: false, error: status === 503 ? "UNAVAILABLE" : code }, status);
};
export async function GET(r: NextRequest) {
  const view = r.nextUrl.searchParams.get("view");
  const a = view === "review" || view === "model-check" ? await requirePlatformAdmin(r) : await requireUser(r);
  if (!a.ok) return reply({ ok: false, error: "ACCESS_REQUIRED" }, a.status);
  if (process.env.CLINICAL_AUTHOR_PILOT_ENABLED !== "1") return reply({ ok: false, error: "PILOT_NOT_ENABLED" }, 503);
  // Read-only connection check; it creates no attempt and never touches the database.
  if (view === "model-check") return reply({ ok: true, check: await checkDiscoveryModel() });
  const db = getSupabaseAdmin();
  if (!db) return reply({ ok: false, error: "UNAVAILABLE" }, 503);
  try {
    if (view === "review") return reply({ ok: true, rows: await reviewPilots(db), limit: 50 });
    const caseId = r.nextUrl.searchParams.get("caseId");
    if (caseId) return reply({ ok: true, traces: await readOwnPilot(db, a.user.id, caseId) });
    return reply({ ok: true, cases: authorCases.map(publicDiscoveryCase), userId: a.user.id, isAdmin: await isActivePlatformAdmin(db, a.user.id) });
  } catch (e) { return fail(e); }
}
export async function POST(r: NextRequest) {
  const a = await requireUser(r);
  if (!a.ok) return reply({ ok: false, error: "ACCESS_REQUIRED" }, a.status);
  if (process.env.CLINICAL_AUTHOR_PILOT_ENABLED !== "1") return reply({ ok: false, error: "PILOT_NOT_ENABLED" }, 503);
  let input: z.infer<typeof inputSchema>;
  try {
    const raw = await r.text();
    if (raw.length > 80000) return reply({ ok: false, error: "TOO_LARGE" }, 413);
    input = inputSchema.parse(JSON.parse(raw));
  } catch { return reply({ ok: false, error: "INVALID_INPUT" }, 400); }
  const db = getSupabaseAdmin();
  if (!db) return reply({ ok: false, error: "UNAVAILABLE" }, 503);
  try {
    const trace = input.operation === "start" ? await createPilot(db, a.user.id, input)
      : await mutatePilot(db, a.user.id, input.traceId, input.requestId, input.operation === "react"
        ? { operation: "react", reaction: input.reaction } : input.operation === "message"
          ? { operation: "message", text: input.text, channel: input.channel } : input.operation === "decision" || input.operation === "conclude"
            ? { operation: input.operation, text: input.text } : { operation: input.operation, answers: input.answers },
        "expectedEventCount" in input ? input.expectedEventCount : undefined);
    return reply({ ok: true, trace });
  } catch (e) { return fail(e); }
}
