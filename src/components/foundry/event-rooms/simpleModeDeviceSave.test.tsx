/** @vitest-environment jsdom */
/**
 * SIMPLE MODE — FOUNDER DEVICE SAVE FAILURE (live draft 6e9817c2-…, deploy 364544f3).
 *
 * THE MEASURED CASE. Goal "신념을 가지고 살면 좋겠어." → suggestion "shares personal beliefs and values
 * openly" / "during team discussions or meetings". The ledger holds four attempts on ONE fingerprint:
 *
 *   #1  validation_refused · non_observable_standard   (Simple Mode's first program)
 *   #2  validation_refused · evidence_overclaim        (its ONE automatic repair, 1s later)
 *   #3  validation_refused · non_observable_standard   (+10s — the detailed builder's "Have BTY write it again")
 *   #4  validation_refused · non_observable_standard   (+3s — the same button again)
 *
 * The intent WAS saved. What failed was the exit: the detailed builder's "couldn't draft the standard"
 * panel was reachable from Simple Mode with the refused answers unchanged, and it spent twice more.
 *
 * These tests drive the REAL shell and the REAL ProgramAuthorship against a fake server, so the
 * legacy panel is genuinely rendered by the component whenever Simple Mode fails to contain it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { MODULE_BUILDER_COPY } from "./moduleBuilderCopy";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { programContext, programContextFingerprint } from "@/domain/foundry/module/program-authorship";

const DRAFT = "d-simple-device";
const GOAL = "신념을 가지고 살면 좋겠어.";
const SUGGESTION = {
  title: "Practice Living with Belief",
  behavior: "shares personal beliefs and values openly",
  when: "during team discussions or meetings",
  successEvidence: "a colleague hears a team member express their beliefs clearly",
};
/** Exactly what the Founder's draft holds after Create (read from production, read-only). */
const SAVED: BuilderAnswers = {
  builderMode: "simple",
  problem: GOAL,
  title: SUGGESTION.title,
  observableBehavior: SUGGESTION.behavior,
  recurringMoment: SUGGESTION.when,
  successEvidence: SUGGESTION.successEvidence,
  audienceType: "everyone",
  materialIntent: "written",
  materialText: "Guidance written by BTY for this training, long enough to be real material.",
} as BuilderAnswers;

/** The route's serialisation of the two refusals the device received. */
const REFUSAL_1 = { error: "invalid_output", refusal: "non_observable_standard", retryable: true, recovery_mode: "regenerate_allowed", recovery_target: { field: "observableBehavior", step: 4 } };
const REFUSAL_2 = { error: "invalid_output", refusal: "evidence_overclaim", retryable: true, recovery_mode: "regenerate_allowed", recovery_target: null };
const LEDGER_VERDICT = { code: "invalid_output", refusal: "non_observable_standard", retryable: true, recovery_mode: "regenerate_allowed", recovery_target: { field: "observableBehavior", step: 4 } };

/** Everything Simple Mode must never say. */
const LEGACY = [
  "couldn’t draft", "couldn't draft", "Have BTY write it again", "Check the standard", "Draft it again",
  "BTY 다시 만들기", "행동 기준 확인하기",
  "non_observable_standard", "evidence_overclaim", "invalid_output", "observable_standard", "refus", "validator",
];

const jsonRes = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

type Opts = { answers?: BuilderAnswers; posts?: Array<{ status: number; body: unknown }>; contextRefusal?: unknown; ledger?: boolean; currentStep?: number };

function server(opts: Opts = {}) {
  const log: Array<{ kind: "patch" | "generate" | "context" | "suggestion" | "guidance"; body?: Record<string, unknown> }> = [];
  const posts = [...(opts.posts ?? [{ status: 502, body: REFUSAL_1 }, { status: 502, body: REFUSAL_2 }])];
  /** `ledger: true` — remember refusals per fingerprint exactly as the attempt ledger does. */
  const refused = new Set<string>();
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    if (u.includes("/assets")) return jsonRes({ assets: [] });
    if (u.endsWith("/simple-suggestion")) { log.push({ kind: "suggestion", body }); return jsonRes({ suggestion: SUGGESTION }); }
    if (u.endsWith("/simple-guidance")) { log.push({ kind: "guidance", body }); return jsonRes({ guidance: "Guidance.", source: "generated" }); }
    if (u.includes("/program-draft")) {
      if (init?.method === "POST") {
        log.push({ kind: "generate", body });
        const r = posts.shift() ?? { status: 502, body: REFUSAL_1 };
        if (r.status >= 400 && (r.body as { refusal?: unknown }).refusal && typeof body?.context_fingerprint === "string") refused.add(body.context_fingerprint);
        return jsonRes(r.body, r.status);
      }
      if (u.includes("context=")) {
        log.push({ kind: "context" });
        if (opts.ledger) {
          const wanted = new URL(u, "http://x").searchParams.get("context") ?? "";
          return jsonRes({ refusal: refused.has(wanted) ? LEDGER_VERDICT : null });
        }
        return jsonRes({ refusal: opts.contextRefusal ?? null });
      }
      return jsonRes({ eligible: true, attempt: null });
    }
    if (u.includes(`/modules/${DRAFT}`)) {
      if (init?.method === "PATCH") { log.push({ kind: "patch", body }); return jsonRes({ ok: true }); }
      return jsonRes({
        draft: {
          id: DRAFT, status: "draft", current_step: opts.currentStep ?? 1, answers: opts.answers ?? {},
          module_version: 1, parent_module_id: null, document_asset_ref_present: false, created_at: "t", updated_at: "t",
        },
      });
    }
    return jsonRes({ ok: true });
  });
  return { fetchMock, log };
}

function open(opts: Opts = {}, locale: "en" | "ko" = "en") {
  const s = server(opts);
  vi.stubGlobal("fetch", s.fetchMock);
  render(<ModuleBuilderShell draftId={DRAFT} locale={locale} onExit={() => {}} />);
  return s;
}

async function createFromGoal() {
  fireEvent.change(await screen.findByTestId("simple-goal"), { target: { value: GOAL } });
  fireEvent.click(screen.getByTestId("simple-continue"));
  fireEvent.click(await screen.findByTestId("simple-use-this"));
  fireEvent.click(await screen.findByTestId("simple-create"));
}

const patchedAnswers = (log: ReturnType<typeof server>["log"]) =>
  log.filter((e) => e.kind === "patch").map((e) => (e.body?.answers ?? {}) as Record<string, unknown>);

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); window.sessionStorage.clear(); });

describe("SIMPLE MODE — the Founder's device case", () => {
  it("1/3/5/6/7 — two refusals end on the calm saved-draft screen; the legacy panel never renders", async () => {
    const s = open();
    await createFromGoal();
    const title = await screen.findByTestId("simple-needs-detail-title");
    expect(title.textContent).toBe("Training saved. BTY needs a little more detail to finish it.");
    // The real ProgramAuthorship reported the refusal; its own panel is not in the document at all.
    expect(screen.queryByTestId("program-auto-regen")).toBeNull();
    expect(screen.queryByTestId("program-auto-blocked")).toBeNull();
    expect(screen.queryByTestId("program-regen-retry")).toBeNull();
    const text = document.body.textContent ?? "";
    for (const phrase of LEGACY) expect(text, phrase).not.toContain(phrase);
    // Exactly one automatic repair, carrying the first refusal code — and nothing after it.
    const gens = s.log.filter((e) => e.kind === "generate");
    expect(gens).toHaveLength(2);
    expect(gens[0].body?.repair_refusal).toBeUndefined();
    expect(gens[1].body?.repair_refusal).toBe("non_observable_standard");
    await new Promise((r) => setTimeout(r, 50));
    expect(s.log.filter((e) => e.kind === "generate")).toHaveLength(2);
  });

  it("2 — the manager's intent is written BEFORE the first program is asked for", async () => {
    const s = open();
    await createFromGoal();
    await screen.findByTestId("simple-needs-detail");
    const firstGenerate = s.log.findIndex((e) => e.kind === "generate");
    const intentPatch = s.log.findIndex((e) => e.kind === "patch" && (e.body?.answers as Record<string, unknown> | undefined)?.builderMode === "simple");
    expect(intentPatch).toBeGreaterThanOrEqual(0);
    expect(intentPatch).toBeLessThan(firstGenerate);
    expect(patchedAnswers(s.log)[intentPatch === -1 ? 0 : s.log.slice(0, intentPatch + 1).filter((e) => e.kind === "patch").length - 1]).toMatchObject({
      builderMode: "simple", problem: GOAL, title: SUGGESTION.title, observableBehavior: SUGGESTION.behavior,
      recurringMoment: SUGGESTION.when, successEvidence: SUGGESTION.successEvidence, audienceType: "everyone", materialIntent: "written",
    });
  });

  it("4 — Edit details opens the detailed builder PRE-FILLED at the behaviour, never at its Review", async () => {
    const s = open();
    await createFromGoal();
    fireEvent.click(await screen.findByTestId("simple-edit-details"));
    expect(await screen.findByText(MODULE_BUILDER_COPY.en.s3Q)).toBeTruthy();
    expect(screen.getByDisplayValue(SUGGESTION.behavior)).toBeTruthy();
    expect(patchedAnswers(s.log).some((a) => a.builderMode === "advanced")).toBe(true);
    expect(screen.queryByTestId("program-auto-regen")).toBeNull();
    expect(s.log.filter((e) => e.kind === "generate")).toHaveLength(2);
  });

  it("a REOPENED saved draft whose answers the ledger already refused: calm screen, ZERO spend, no legacy panel", async () => {
    const s = open({ answers: SAVED, contextRefusal: LEDGER_VERDICT });
    expect((await screen.findByTestId("simple-needs-detail-title")).textContent).toBe("Training saved. BTY needs a little more detail to finish it.");
    await waitFor(() => expect(s.log.some((e) => e.kind === "context")).toBe(true));
    expect(s.log.filter((e) => e.kind === "generate")).toHaveLength(0);
    const text = document.body.textContent ?? "";
    for (const phrase of LEGACY) expect(text, phrase).not.toContain(phrase);
    expect(screen.queryByTestId("simple-goal"), "a saved training must not start over").toBeNull();
  });

  it("KO — the saved-draft sentence in Korean", async () => {
    open({ answers: SAVED, contextRefusal: LEDGER_VERDICT }, "ko");
    expect((await screen.findByTestId("simple-needs-detail-title")).textContent).toBe("트레이닝은 저장되었습니다. BTY가 완성하려면 조금만 더 구체화하면 됩니다.");
    expect(document.body.textContent).not.toContain("BTY 다시 만들기");
  });

  it("9 — an infrastructure failure keeps the saved intent and says so truthfully; it is not turned into editing", async () => {
    const s = open({ posts: [{ status: 503, body: { error: "provider_unavailable", refusal: null, retryable: true, recovery_mode: "transient_retry", recovery_target: null } }] });
    await createFromGoal();
    expect(await screen.findByTestId("simple-create-failed")).toBeTruthy();
    expect(screen.queryByTestId("simple-needs-detail")).toBeNull();
    expect(s.log.filter((e) => e.kind === "generate")).toHaveLength(1);
    expect(patchedAnswers(s.log).some((a) => a.builderMode === "simple" && a.observableBehavior === SUGGESTION.behavior)).toBe(true);
  });
});

/* ============================================================================================
   REFUSAL HANDOFF PROTECTION (Option A). The exact device sequence, end to end:
   two refused attempts → calm screen → Edit details → behaviour step → Next with NO edit.
   The ledger is fingerprint-aware here, so "unchanged" and "changed" mean what they mean live.
   ============================================================================================ */

const LEGACY_ADVANCED = ["couldn’t draft", "Have BTY write it again", "Check the standard", "BTY 다시 만들기", "행동 기준 확인하기"];
const SUCCESS = { status: 200, body: { program: { displayTitle: "x", elements: [], assumptions: [], warnings: [] }, evidence_ceiling: "", attempt_id: "6f1d2c7e-8a41-4f0b-9c33-2b7d5e0a1f42", context_fingerprint: "" } };
const handoffPatches = (log: ReturnType<typeof server>["log"]) =>
  patchedAnswers(log).map((a) => a.simpleRefusalHandoffV1).filter(Boolean) as Array<{ fingerprint: string; active: boolean }>;

async function founderPathToNext(s: ReturnType<typeof server>, locale: "en" | "ko" = "en") {
  await createFromGoal();
  fireEvent.click(await screen.findByTestId("simple-edit-details"));
  expect(await screen.findByText(MODULE_BUILDER_COPY[locale].s3Q)).toBeTruthy();
  expect(screen.getByDisplayValue(SUGGESTION.behavior), "behaviour step is pre-filled").toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: MODULE_BUILDER_COPY[locale].next }));
  return s;
}

describe("SIMPLE MODE REFUSAL HANDOFF — the exact Founder path", () => {
  it("1–10 — Next with NO edit: zero further spend, no legacy panel, the calm 'Edit the behavior' state", async () => {
    const s = open({ ledger: true });
    await founderPathToNext(s);
    expect((await screen.findByTestId("program-simple-handoff-title")).textContent).toBe("Training saved. Edit the behavior to help BTY finish it.");
    expect(screen.getByTestId("program-simple-handoff-edit").textContent).toBe("Edit the behavior");
    await new Promise((r) => setTimeout(r, 300));
    expect(s.log.filter((e) => e.kind === "generate"), "navigation is not new information").toHaveLength(2);
    expect(screen.queryByTestId("program-auto-regen")).toBeNull();
    expect(screen.queryByTestId("program-regen-retry")).toBeNull();
    const text = document.body.textContent ?? "";
    for (const phrase of LEGACY_ADVANCED) expect(text, phrase).not.toContain(phrase);
    // The marker is the refused context's canonical fingerprint — the same key the ledger uses.
    const refusedFp = s.log.filter((e) => e.kind === "generate")[1].body?.context_fingerprint;
    expect(handoffPatches(s.log)[0]).toEqual({ fingerprint: refusedFp, active: true });
    // Entering the detailed builder did NOT clear it.
    expect(handoffPatches(s.log).some((h) => h.active === false)).toBe(false);
  });

  it("11–14 — after a REAL edit to the behaviour, generation is allowed again, and success clears the marker", async () => {
    const s = open({ ledger: true, posts: [{ status: 502, body: REFUSAL_1 }, { status: 502, body: REFUSAL_2 }, SUCCESS] });
    await founderPathToNext(s);
    fireEvent.click(await screen.findByTestId("program-simple-handoff-edit"));
    const input = await screen.findByDisplayValue(SUGGESTION.behavior);
    fireEvent.change(input, { target: { value: "names one value that guided a decision and why, in the meeting" } });
    fireEvent.click(screen.getByRole("button", { name: MODULE_BUILDER_COPY.en.next }));
    await waitFor(() => expect(s.log.filter((e) => e.kind === "generate")).toHaveLength(3));
    const gens = s.log.filter((e) => e.kind === "generate");
    expect(gens[2].body?.context_fingerprint).not.toBe(gens[1].body?.context_fingerprint);
    expect(gens[2].body?.repair_refusal, "the detailed builder never sends a Simple repair").toBeUndefined();
    await waitFor(() => expect(handoffPatches(s.log).some((h) => h.active === false)).toBe(true));
  });

  it("15 — REOPEN the handed-over draft (detailed builder, Review, answers unchanged): zero spend, calm state", async () => {
    const refusedFp = programContextFingerprint(programContext(SAVED)!);
    const s = open({ answers: { ...SAVED, builderMode: "advanced", simpleRefusalHandoffV1: { fingerprint: refusedFp, active: true } } as BuilderAnswers, contextRefusal: LEDGER_VERDICT, currentStep: 7 });
    expect(await screen.findByTestId("program-simple-handoff")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));
    expect(s.log.filter((e) => e.kind === "generate")).toHaveLength(0);
    expect(screen.queryByTestId("program-auto-regen")).toBeNull();
  });

  it("16 — KO: the same protection, in Korean", async () => {
    const s = open({ ledger: true }, "ko");
    await founderPathToNext(s, "ko");
    expect((await screen.findByTestId("program-simple-handoff-title")).textContent).toBe("트레이닝은 저장되었습니다. 행동을 조금 수정하면 BTY가 완성할 수 있습니다.");
    await new Promise((r) => setTimeout(r, 300));
    expect(s.log.filter((e) => e.kind === "generate")).toHaveLength(2);
    for (const phrase of LEGACY_ADVANCED) expect(document.body.textContent ?? "", phrase).not.toContain(phrase);
  });

  it("17 — an ordinary Advanced-origin draft refused on the same answers keeps the Advanced panel (no marker, no hold)", async () => {
    const { builderMode: _m, ...plain } = SAVED as Record<string, unknown>;
    open({ answers: plain as BuilderAnswers, contextRefusal: LEDGER_VERDICT, currentStep: 7 });
    expect(await screen.findByTestId("program-auto-regen")).toBeTruthy();
    expect(screen.getByTestId("program-regen-retry").textContent).toBe("Have BTY write it again");
    expect(screen.queryByTestId("program-simple-handoff")).toBeNull();
  });

  it("an INACTIVE marker (already cleared) does not hold", async () => {
    const refusedFp = programContextFingerprint(programContext(SAVED)!);
    open({ answers: { ...SAVED, builderMode: "advanced", simpleRefusalHandoffV1: { fingerprint: refusedFp, active: false } } as BuilderAnswers, contextRefusal: LEDGER_VERDICT, currentStep: 7 });
    expect(await screen.findByTestId("program-auto-regen")).toBeTruthy();
    expect(screen.queryByTestId("program-simple-handoff")).toBeNull();
  });
});
