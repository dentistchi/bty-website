/** @vitest-environment jsdom */
/**
 * SLICE R4-R9A — HOST AUTHORING RECOVERY TRUTH A.
 *
 * THE MEASURED DEFECT, on live draft `adb75f6a-…` (Korean, deploy 8266f35f):
 *
 *   attempt #1  validation_refused · non_observable_standard · structural_retryable=false
 *   the Builder offered  다시 시도
 *   the Founder tapped it
 *   attempt #2  a REAL second provider call, a genuinely different response, the same verdict
 *
 * and the other offered action, 직접 계속하기, seeded a journey with four of the eight required
 * sections and a Create button that could never enable.
 *
 * Two false recoveries and no true one. These tests hold the differential: for the same
 * unchanged context, the second spend does not happen — not because a button was hidden, but
 * because the surface now asks the server what it already established and believes the answer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { MODULE_BUILDER_COPY, objectParticle } from "./moduleBuilderCopy";
import { programContext, programContextFingerprint } from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

const DRAFT = "d-r4r9a";

/** The Founder's own draft shape: the six answers slice B collects, nothing else. */
const FRESH = {
  title: "업무 인계 확인하기",
  problem: "업무를 인계한 뒤 서로 확인하지 않아 중요한 일이 빠진다.",
  audienceType: "leaders",
  recurringMoment: "업무를 다른 사람에게 넘길 때",
  observableBehavior: "업무를 넘길 때 해야 할 일과 완료 시점을 분명히 말하고, 상대가 이해한 내용을 한 번 확인한다.",
  successEvidence: "업무를 받은 사람이 해야 할 일과 완료 시점을 정확히 설명할 수 있고, 정한 시점에 완료 여부가 확인된다.",
  evidenceType: "seen",
  materialIntent: "written",
  materialText: "인계 기준 한 장.",
} as unknown as BuilderAnswers;

const FINGERPRINT = programContextFingerprint(programContext(FRESH)!);
const jsonRes = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

type Opts = {
  /** What POST /program-draft answers. Default: the measured non-retryable refusal. */
  post?: () => { body: unknown; status: number };
  /** What GET …?context= answers — the ledger's verdict for this fingerprint. */
  contextRefusal?: unknown;
  answers?: BuilderAnswers;
};

function server(opts: Opts = {}) {
  const calls = { provider: 0, contextRead: 0, patch: 0 };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/assets")) return jsonRes({ assets: [] });
    if (u.includes("/program-draft")) {
      if (init?.method === "POST") {
        calls.provider += 1;
        const r = opts.post
          ? opts.post()
          : {
              status: 502,
              body: {
                error: "invalid_output",
                refusal: "non_observable_standard",
                retryable: true,
                recovery_mode: "regenerate_allowed",
                recovery_target: { field: "observableBehavior", step: 4 },
              },
            };
        return jsonRes(r.body, r.status);
      }
      if (u.includes("context=")) {
        calls.contextRead += 1;
        return jsonRes({ refusal: opts.contextRefusal ?? null });
      }
      return jsonRes({ eligible: true, attempt: null });
    }
    if (u.includes(`/modules/${DRAFT}`)) {
      if (init?.method === "PATCH") {
        calls.patch += 1;
        return jsonRes({ ok: true });
      }
      return jsonRes({
        draft: {
          id: DRAFT, status: "draft", current_step: 7, answers: opts.answers ?? FRESH,
          module_version: 1, parent_module_id: null, document_asset_ref_present: false,
          created_at: "t", updated_at: "t",
        },
      });
    }
    return jsonRes({ ok: true });
  });
  return { fetchMock, calls };
}

function openReview(opts: Opts = {}, locale: "en" | "ko" = "ko") {
  const s = server(opts);
  vi.stubGlobal("fetch", s.fetchMock);
  render(<ModuleBuilderShell draftId={DRAFT} locale={locale} initialView="review" onExit={() => {}} />);
  return s;
}

/** The ledger's answer for a context already refused, exactly as the route serialises it. */
const LEDGER_REFUSAL = {
  code: "invalid_output",
  refusal: "non_observable_standard",
  retryable: true,
  recovery_mode: "regenerate_allowed",
  recovery_target: { field: "observableBehavior", step: 4 },
};

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); window.sessionStorage.clear(); });

describe("R4-R9A — a non-retryable refusal offers one truthful action", () => {
  it("T2/T3/T4 — no 다시 시도, no 직접 계속하기, one source-repair CTA", async () => {
    openReview();
    const panel = await screen.findByTestId("program-auto-regen");
    expect(screen.queryByTestId("program-auto-retry"), "다시 시도 must not be offered").toBeNull();
    expect(screen.queryByTestId("program-auto-manual"), "직접 계속하기 must not be offered").toBeNull();
    expect(screen.getByTestId("program-regen-retry")).toBeTruthy();
    // Exactly one action on the surface.
    expect(panel.querySelectorAll("button")).toHaveLength(2);
  });

  it("T4b — it says what BTY could not draft, in the Host's language, and blames nobody", async () => {
    openReview();
    const title = await screen.findByTestId("program-regen-title");
    expect(title.textContent).toBe("BTY가 행동 기준을 초안으로 만들지 못했습니다.");
    expect(screen.getByTestId("program-regen-retry").textContent).toBe("BTY 다시 만들기");
    expect(screen.getByTestId("program-regen-source").textContent).toBe("행동 기준 확인하기");
    const surface = (await screen.findByTestId("program-auto-regen")).textContent ?? "";
    for (const blame of ["잘못", "오류", "실패했습니다"]) expect(surface, blame).not.toContain(blame);
  });

  it("T14 — no validator or internal vocabulary reaches the Host", async () => {
    openReview();
    const surface = (await screen.findByTestId("program-auto-regen")).textContent ?? "";
    for (const internal of [
      "observable_standard", "non_observable_standard", "action_reclaims_authority",
      "observable_action", "invalid_output", "elements.", "structural_retryable", "retryable",
    ]) {
      expect(surface, internal).not.toContain(internal);
    }
  });

  it("T5/T6 — the CTA opens the behaviour step, and reaches no provider", async () => {
    const s = openReview();
    fireEvent.click(await screen.findByTestId("program-regen-source"));
    // Step 4 is "이 훈련 후, 무엇을 다르게 해야 하나요?" — the answer the refusal names.
    expect(await screen.findByText(MODULE_BUILDER_COPY.ko.s3Q)).toBeTruthy();
    expect(s.calls.provider, "looking at the source must never spend").toBe(1);
  });

  it("the English surface says the same thing", async () => {
    openReview({}, "en");
    const title = await screen.findByTestId("program-regen-title");
    expect(title.textContent).toBe("BTY couldn’t draft the standard.");
    expect(screen.getByTestId("program-regen-retry").textContent).toBe("Have BTY write it again");
  });
});

describe("R4-R9A — the same failed context does not re-spend", () => {
  it("T7 — reopening a draft the ledger has already refused makes ZERO provider calls", async () => {
    /*
      THE PRE-FIX DIFFERENTIAL, in its most costly form. Before this slice the automatic path saw
      an idle surface and a complete draft and generated — every reopen, every restart, for inputs
      already proven to fail.
    */
    const s = openReview({ contextRefusal: LEDGER_REFUSAL });
    await screen.findByTestId("program-auto-regen");
    await waitFor(() => expect(s.calls.contextRead).toBe(1));
    expect(s.calls.provider).toBe(0);
    expect(screen.queryByTestId("program-auto-retry")).toBeNull();
    expect(screen.getByTestId("program-regen-retry").textContent).toBe("BTY 다시 만들기");
    expect(screen.getByTestId("program-regen-source").textContent).toBe("행동 기준 확인하기");
  });

  it("T8 — and a second mount of the same draft still makes ZERO", async () => {
    const first = openReview({ contextRefusal: LEDGER_REFUSAL });
    await screen.findByTestId("program-auto-regen");
    cleanup();
    const again = openReview({ contextRefusal: LEDGER_REFUSAL });
    await screen.findByTestId("program-auto-regen");
    expect(first.calls.provider + again.calls.provider).toBe(0);
  });

  it("T7b — a ledger that cannot answer fails OPEN: generation still runs", async () => {
    // Being unable to read the ledger must never be able to stop somebody creating a training.
    const s = openReview({ contextRefusal: null });
    await screen.findByTestId("program-auto-regen");
    expect(s.calls.provider).toBe(1);
  });

  it("T9/T10 — a real edit moves the fingerprint, and the new context may generate once", async () => {
    const edited = { ...FRESH, observableBehavior: "해야 할 일과 완료 시점을 분명히 말한다." } as BuilderAnswers;
    expect(programContextFingerprint(programContext(edited)!)).not.toBe(FINGERPRINT);
    // The ledger holds a verdict for the OLD fingerprint only, so the new one is unblocked.
    const s = openReview({
      answers: edited,
      contextRefusal: null,
      post: () => ({ status: 502, body: { error: "invalid_output", refusal: "non_observable_standard", retryable: true, recovery_mode: "regenerate_allowed", recovery_target: { field: "observableBehavior", step: 4 } } }),
    });
    await screen.findByTestId("program-auto-regen");
    expect(s.calls.provider, "exactly one attempt for the new context").toBe(1);
  });
});

describe("R4-R9A — a genuinely retryable failure is unchanged", () => {
  const TRANSIENT = { status: 503, body: { error: "provider_unavailable", refusal: null, retryable: true, recovery_mode: "transient_retry", recovery_target: null } };

  it("T11 — it still offers 다시 시도", async () => {
    openReview({ post: () => TRANSIENT });
    await screen.findByTestId("program-auto-failed");
    expect(screen.getByTestId("program-auto-retry")).toBeTruthy();
    expect(screen.queryByTestId("program-auto-regen")).toBeNull();
  });

  it("T12 — tapping it makes exactly ONE more provider call", async () => {
    const s = openReview({ post: () => TRANSIENT });
    await screen.findByTestId("program-auto-failed");
    expect(s.calls.provider).toBe(1);
    fireEvent.click(screen.getByTestId("program-auto-retry"));
    await waitFor(() => expect(s.calls.provider).toBe(2));
  });

  it("T3b — and it does NOT offer the dead direct-continue path either", async () => {
    openReview({ post: () => TRANSIENT });
    const panel = await screen.findByTestId("program-auto-failed");
    expect(screen.queryByTestId("program-auto-manual")).toBeNull();
    expect(panel.querySelectorAll("button")).toHaveLength(1);
  });

  it("T13 — a retryable failure alone does not re-spend without a tap", async () => {
    const s = openReview({ post: () => TRANSIENT });
    await screen.findByTestId("program-auto-failed");
    await new Promise((r) => setTimeout(r, 250));
    expect(s.calls.provider).toBe(1);
  });
});

describe("R4-R9A — a refusal about BTY's own section still lands somewhere real", () => {
  /*
    `scenario`, `action_decision`, `field_application` and `follow_up` are sections BTY writes;
    no Builder answer owns them. The CTA must still ACT — a recovery button that cannot do
    anything is the same false action this slice removes, in a quieter costume.
  */
  const OWN_SECTION = {
    status: 502,
    body: { error: "invalid_output", refusal: "scenario_without_pressure", retryable: true, recovery_mode: "regenerate_allowed", recovery_target: null },
  };

  it("offers regeneration with no source escape, because no Host answer owns it", async () => {
    openReview({ post: () => OWN_SECTION });
    const panel = await screen.findByTestId("program-auto-regen");
    expect(screen.getByTestId("program-regen-retry").textContent).toBe(MODULE_BUILDER_COPY.ko.paRegenCta);
    // No "check your answer" escape is invented for a section the Host never wrote.
    expect(screen.queryByTestId("program-regen-source")).toBeNull();
    expect(panel.querySelectorAll("button")).toHaveLength(1);
  });

  it("T11 — and tapping it makes exactly ONE more provider call", async () => {
    const s = openReview({ post: () => OWN_SECTION });
    await screen.findByTestId("program-auto-regen");
    expect(s.calls.provider).toBe(1);
    fireEvent.click(screen.getByTestId("program-regen-retry"));
    await waitFor(() => expect(s.calls.provider).toBe(2));
  });
});

describe("R4-R9B — regeneration is one deliberate call, and reopen is still free", () => {
  it("T11/T12 — the measured refusal regenerates once, and may succeed", async () => {
    /*
      THE CORRECTION R9B EXISTS FOR. On the Founder's draft, attempt #3 succeeded on the exact
      fingerprint two refusals had rejected — so a regeneration is not a paid re-roll of a settled
      verdict, it is the honest next step. One tap, one call, and a success reaches the preview.
    */
    let refuse = true;
    const s = openReview({
      post: () =>
        refuse
          ? ((refuse = false),
            { status: 502, body: { error: "invalid_output", refusal: "non_observable_standard", retryable: true, recovery_mode: "regenerate_allowed", recovery_target: { field: "observableBehavior", step: 4 } } })
          : { status: 502, body: { error: "provider_unavailable", retryable: true, recovery_mode: "transient_retry", recovery_target: null } },
    });
    await screen.findByTestId("program-auto-regen");
    expect(s.calls.provider).toBe(1);
    fireEvent.click(screen.getByTestId("program-regen-retry"));
    await waitFor(() => expect(s.calls.provider).toBe(2));
    // The second response was transient, so the plain retry surface takes over — one call, no chain.
    await screen.findByTestId("program-auto-failed");
    await new Promise((r) => setTimeout(r, 200));
    expect(s.calls.provider, "nothing chains a third call by itself").toBe(2);
  });

  it("T10 — a remembered regenerable refusal still spends NOTHING on reopen", async () => {
    const s = openReview({ contextRefusal: LEDGER_REFUSAL });
    await screen.findByTestId("program-auto-regen");
    await waitFor(() => expect(s.calls.contextRead).toBe(1));
    expect(s.calls.provider, "reopening must never spend").toBe(0);
  });

  it("T20 — and it never claims the training changed when it did not", async () => {
    openReview({ contextRefusal: LEDGER_REFUSAL });
    const surface = (await screen.findByTestId("program-auto-regen")).textContent ?? "";
    expect(surface).not.toContain("교육 내용이 변경되었습니다");
    expect(surface).not.toContain("다시 초안 만들기");
  });

  it("T19 — the KO recovery surface carries no English", async () => {
    openReview({ contextRefusal: LEDGER_REFUSAL });
    const surface = (await screen.findByTestId("program-auto-regen")).textContent ?? "";
    expect(surface).not.toMatch(/[A-Za-z]{4,}/);
  });
});

describe("R4-R9A — the second dead end is closed too", () => {
  it("the manual journey seed is not offered when it would build an unpublishable training", async () => {
    /*
      MEASURED: seeding by hand from these answers produces four of the eight required sections,
      and `JourneyPreview` renders only elements a journey HAS — so the other four could not be
      written anywhere and Create stayed disabled forever.
    */
    openReview({ contextRefusal: LEDGER_REFUSAL });
    await screen.findByTestId("program-auto-regen");
    expect(screen.queryByTestId("journey-start")).toBeNull();
  });
});

describe("R4-R9A — the Korean reads like Korean", () => {
  it("the object particle follows the sound, not a template", () => {
    // 행동 기준 ends in a consonant and takes 을; 자료 ends in a vowel and takes 를.
    expect(objectParticle("행동 기준")).toBe("을");
    expect(objectParticle("자료")).toBe("를");
    expect(objectParticle("반복되는 문제")).toBe("를");
    expect(objectParticle("대상")).toBe("을");
    for (const name of Object.values(MODULE_BUILDER_COPY.ko.hostSourceField)) {
      expect(MODULE_BUILDER_COPY.ko.paBlockedTitle(name)).toContain(`${name}${objectParticle(name)}`);
    }
  });
});

describe("R4-R9A — Simplification A/B is unchanged", () => {
  it("T15 — one generator, one preview, no keep/use, no extra review layer", async () => {
    openReview({
      contextRefusal: null,
      post: () => ({ status: 502, body: { error: "provider_unavailable", retryable: true, recovery_mode: "transient_retry", recovery_target: null } }),
    });
    await screen.findByTestId("program-auto-failed");
    expect(screen.queryByTestId("program-authorship-entry")).toBeNull();
    expect(screen.queryByTestId("program-target-confirm")).toBeNull();
    expect(screen.queryByTestId("program-review")).toBeNull();
    expect(document.querySelectorAll('[data-testid^="program-keep-"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-testid^="program-use-"]')).toHaveLength(0);
    expect(screen.getByTestId("publish-cta")).toBeTruthy();
  });
});
