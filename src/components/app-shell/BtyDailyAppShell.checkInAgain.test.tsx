/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R3-R1 — My Learning → "Check in again" → the follow-up, in-shell.
 *
 * The service has accepted a later check-in since 3.2M-3 and the product could not reach it: the
 * only `?followup=` link in the app is the Today row, and Today drops RESPONDED obligations. This
 * mounts the REAL shell and proves the return route end to end, from BOTH origins, without any
 * document navigation and without a second tap — the same bar 3.2G-R2 had to meet.
 *
 * Back is origin-aware on purpose. The follow-up surface renders under Learn, so a learner who
 * opened it from Me → My Learning must come back to Me, not be quietly relocated to Learn.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ENTRY = "8c3f21aa-1111-4222-8333-444444444444";
const FOLLOWUP = "c034bbf0-84b1-4b8f-99f6-ba429b169812";
const TRAINING = "Establishing Action Ownership in Huddles";

const historyRow = {
  entryId: ENTRY,
  eventId: "4d1b2375-d493-4cee-a2a1-0f6f7180b9b0",
  eventTitle: TRAINING,
  contentType: "youtube",
  completedAt: "2026-08-15T19:30:35.355Z",
  sharedUnderstanding: "One clear owner and one clear deadline.",
};

/** The settled, non-terminal obligation the CTA must open. */
const followupPayload = {
  ok: true,
  followup: {
    id: FOLLOWUP,
    sourceTrainingTitle: TRAINING,
    followUpDays: 7,
    dueAt: "2026-08-22T12:00:00Z",
    dueState: "responded",
    status: "RESPONDED",
    outcome: "NOT_YET",
    respondedAt: "2026-08-22T18:00:00Z",
    expectedBehavior: "Name one owner and one deadline before the huddle ends.",
    canCheckInAgain: true,
  },
};

/** Every request the shell makes, so "reading writes nothing" is asserted, not asserted-about. */
const calls: Array<{ url: string; method?: string }> = [];

function stub() {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string }) => {
      const u = String(url);
      calls.push({ url: u, method: init?.method });
      const body = u.includes("/api/auth/session")
        ? { ok: true, user: { email: "learner@example.com" } }
        : u.includes("/api/me/today/brief")
          ? { ok: true, reminders: [], hostAttention: [] }
          : u.includes("/api/bty/foundry/evidence/mine")
            ? {
                ok: true,
                items: [
                  {
                    entryId: ENTRY,
                    eventId: historyRow.eventId,
                    established: ["exposed", "reflected", "decided"],
                    highestEstablished: "decided",
                    checkInAgain: [{ followupId: FOLLOWUP, followUpDays: 7, outcome: "NOT_YET" }],
                  },
                ],
              }
            : u.includes("/api/bty/foundry/history")
              ? { history: [historyRow], thread: null, threadStatus: "none" }
              : u.includes(`/api/bty/foundry/followups/${FOLLOWUP}`)
                ? followupPayload
                : u.includes("/api/bty/foundry/events") && !u.match(/events\/[^/?]+/)
                  ? { events: [] }
                  : { ok: true, rows: [], responses: [], items: [], drafts: [], history: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

/** Open Learn → My Learning through the shell's own address, the way a learner reaches it. */
function renderAt(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  return render(<BtyDailyAppShell locale="en" />);
}

describe("3.2R-R3-R1 — the return route, in-shell", () => {
  it("Learn → My Learning → first tap → the follow-up opens, with its later check-in offered", async () => {
    stub();
    renderAt("?tab=foundry&view=my-learning");

    const cta = await screen.findByTestId("my-learning-check-in-again");
    expect(cta.tagName).toBe("BUTTON"); // an app-shell command, never a raw href (3.2G-R2)

    fireEvent.click(cta); // FIRST activation — no retry

    await waitFor(() => expect(screen.getByTestId("foundry-followup-response")).toBeTruthy());
    // It opened THAT obligation, and the surface offers the later check-in the server authorised.
    await waitFor(() => expect(screen.getByTestId("followup-check-in-again")).toBeTruthy());
    expect(screen.getByTestId("followup-settled").textContent).toContain("I have not tried it yet");
    // No URL transport: the address bar was not used to carry the command.
    expect(window.location.search).toBe("");
  });

  it("Back from a Learn origin returns to My Learning, not to the Foundry home", async () => {
    stub();
    renderAt("?tab=foundry&view=my-learning");
    fireEvent.click(await screen.findByTestId("my-learning-check-in-again"));
    await waitFor(() => expect(screen.getByTestId("foundry-followup-response")).toBeTruthy());

    fireEvent.click(screen.getByTestId("followup-back"));
    await waitFor(() => expect(screen.getByTestId("foundry-my-learning")).toBeTruthy());
  });

  it("Back from a ME origin returns to Me → My Learning, never silently to Learn", async () => {
    stub();
    /*
      Reached by NAVIGATION, not by an address. `?view=my-learning` is resolved by the shell to the
      LEARN entry regardless of `tab`, so a URL cannot express the Me origin — the learner gets
      there by tapping "What I learned" on the Me root. Writing this test against the URL would
      have proven the Learn path twice and the Me path never.
    */
    renderAt("?tab=me");
    fireEvent.click(await screen.findByTestId("me-row-learned"));

    // The Me entry renders the same surface with the Me back label.
    const cta = await screen.findByTestId("my-learning-check-in-again");
    fireEvent.click(cta);
    await waitFor(() => expect(screen.getByTestId("foundry-followup-response")).toBeTruthy());

    fireEvent.click(screen.getByTestId("followup-back"));
    await waitFor(() => expect(screen.getByTestId("foundry-my-learning")).toBeTruthy());
    // The Me origin is what proves it: the back label is the one only the Me entry passes.
    expect(screen.getByTestId("my-learning-back").textContent).toContain("Me");
  });

  it("walking the whole route writes NOTHING — every request is a read", async () => {
    stub();
    renderAt("?tab=foundry&view=my-learning");
    fireEvent.click(await screen.findByTestId("my-learning-check-in-again"));
    await waitFor(() => expect(screen.getByTestId("followup-check-in-again")).toBeTruthy());
    fireEvent.click(screen.getByTestId("followup-back"));
    await waitFor(() => expect(screen.getByTestId("foundry-my-learning")).toBeTruthy());

    /*
      Scoped to the paths this route actually touches. The shell posts `/api/me/day/open` on mount
      — a pre-existing daily-open ping that fires whatever the learner then does — and folding it
      in would make this assertion about shell startup rather than about the return route.
    */
    const ROUTE = ["/api/bty/foundry/evidence/mine", "/api/bty/foundry/history", "/api/bty/foundry/followups/"];
    const touched = calls.filter((c) => ROUTE.some((p) => c.url.includes(p)));
    expect(touched.length).toBeGreaterThan(0);
    expect(touched.filter((c) => c.method && c.method.toUpperCase() !== "GET")).toEqual([]);
    // And nothing on the whole walk wrote to the follow-up chain by any other address.
    const writes = calls.filter((c) => c.method && c.method.toUpperCase() !== "GET");
    expect(writes.map((w) => w.url)).toEqual(["/api/me/day/open"]);
  });
});
