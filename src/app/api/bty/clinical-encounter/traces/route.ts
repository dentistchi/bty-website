import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { encounterRecord, V2_SCHEMA } from "@/domain/clinical-encounter/serverPersistence";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(r: NextRequest) {
  const a = await requireUser(r);
  if (!a.ok) return reply({ ok: false }, a.status);
  const d = getSupabaseAdmin();
  if (!d) return reply({ ok: false, error: "UNAVAILABLE" }, 503);
  let query = d.from("clinical_reasoning_traces").select("raw_trace,status")
    .eq("user_id", a.user.id).eq("trace_schema_version", V2_SCHEMA).eq("trace_role", "learner");
  const params = r.nextUrl.searchParams;
  if (params.get("caseId")) query = query.eq("case_id", params.get("caseId")!);
  if (params.get("caseVersion")) query = query.eq("case_version", params.get("caseVersion")!);
  if (params.get("traceId")) query = query.eq("trace_id", params.get("traceId")!);
  if (params.get("status") === "active") query = query.eq("status", "active");
  const x = await query.order("updated_at", { ascending: false }).limit(50);
  return x.error ? reply({ ok: false, error: "LOAD_FAILED" }, 500) : reply({ ok: true, traces: x.data });
}

export async function POST(r: NextRequest) {
  const a = await requireUser(r);
  if (!a.ok) return reply({ ok: false }, a.status);
  let row;
  try {
    const body = await r.json();
    if (body?.operation !== "save" && body?.operation !== "complete") return reply({ ok: false, error: "INVALID_OPERATION" }, 400);
    row = encounterRecord(a.user.id, body.trace, body.operation === "complete" ? "completed" : "active");
  } catch (error) {
    return reply({ ok: false, error: error instanceof Error && error.message === "INVALID_COMPLETION" ? "INVALID_COMPLETION" : "INVALID_TRACE" }, 400);
  }
  const d = getSupabaseAdmin();
  if (!d) return reply({ ok: false, error: "UNAVAILABLE" }, 503);
  const old = await d.from("clinical_reasoning_traces").select("user_id,status,case_id,case_version,trace_schema_version,trace_role")
    .eq("trace_id", row.trace_id).maybeSingle();
  if (old.error) return reply({ ok: false, error: "LOAD_FAILED" }, 500);
  if (old.data) {
    if (old.data.user_id !== a.user.id) return reply({ ok: false }, 403);
    if (old.data.status === "completed") return reply({ ok: false, error: "IMMUTABLE" }, 409);
    if (old.data.case_id !== row.case_id || old.data.case_version !== row.case_version
      || old.data.trace_schema_version !== V2_SCHEMA || old.data.trace_role !== "learner") return reply({ ok: false, error: "TRACE_CONFLICT" }, 409);
  }
  // Guard in the UPDATE itself: a concurrent completion must never be overwritten.
  // INSERT (not upsert) ensures a concurrent creator cannot replace another owner's row.
  const write = old.data
    ? d.from("clinical_reasoning_traces").update({ ...row, updated_at: new Date().toISOString() })
      .eq("trace_id", row.trace_id).eq("user_id", a.user.id).eq("status", "active")
      .eq("trace_schema_version", V2_SCHEMA).eq("trace_role", "learner")
    : d.from("clinical_reasoning_traces").insert(row);
  const x = await write.select("trace_id").maybeSingle();
  if (x.error) return reply({ ok: false, error: x.error.code === "23505" ? "TRACE_CONFLICT" : "SAVE_FAILED" }, x.error.code === "23505" ? 409 : 500);
  if (!x.data) return reply({ ok: false, error: "IMMUTABLE" }, 409);
  return reply({ ok: true, status: row.status });
}
