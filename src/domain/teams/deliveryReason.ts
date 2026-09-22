/**
 * WHY ONE RECIPIENT DID NOT RECEIVE A TRAINING — the Host-facing reading. PURE.
 * Slice Teams Delivery Diagnostics V1.
 *
 * ★ THE DEFECT THIS CLOSES. The send API already returned a product reason for every recipient it
 * could not deliver to, and the client threw it away — so "the app isn't installed for them",
 * "that account can't receive it", "we can't reach Teams for this org yet" and "Teams never
 * confirmed" all reached the Host as one undifferentiated failure. Those are four different things
 * to do next, and only the first is the Host's to fix.
 *
 * ★ NEVER A MICROSOFT STRING. The wire carries a small closed set of product reasons; Microsoft's
 * own codes stay in the server log and the audit table. An unrecognised value reads as the
 * honest generic rather than being rendered raw — a reason a client invented must never become
 * text on a Host's screen.
 */

export const DELIVERY_REASONS = ["not_installed", "not_eligible", "no_route", "unknown", "failed"] as const;
export type DeliveryReason = (typeof DELIVERY_REASONS)[number];

export function isDeliveryReason(raw: unknown): raw is DeliveryReason {
  return typeof raw === "string" && (DELIVERY_REASONS as readonly string[]).includes(raw);
}

/** Copy keys, so the sentences live in the locale dictionary and this stays pure. */
export type DeliveryReasonCopy = {
  sendReasonNotInstalled: string;
  sendReasonNotEligible: string;
  sendReasonNoRoute: string;
  sendReasonUnknown: string;
  sendReasonFailed: string;
};

/** A TOTAL map — a new reason cannot be added without deciding what a Host is told. */
export function deliveryReasonSentence(raw: unknown, t: DeliveryReasonCopy): string {
  const reason: DeliveryReason = isDeliveryReason(raw) ? raw : "failed";
  switch (reason) {
    case "not_installed":
      return t.sendReasonNotInstalled;
    case "not_eligible":
      return t.sendReasonNotEligible;
    case "no_route":
      return t.sendReasonNoRoute;
    case "unknown":
      return t.sendReasonUnknown;
    case "failed":
      return t.sendReasonFailed;
    default: {
      const exhaustive: never = reason;
      void exhaustive;
      return t.sendReasonFailed;
    }
  }
}

export type UndeliverableRow = { displayName: string | null; reason?: unknown };

/**
 * Group the people who did not receive it BY REASON, so a Host reads one sentence per cause with
 * the names under it rather than a name-by-name list that repeats the same sentence.
 * Order is the order the reasons first appeared, so the output is deterministic.
 */
export function groupUndeliverable(
  rows: readonly UndeliverableRow[],
  t: DeliveryReasonCopy,
): { sentence: string; names: string[] }[] {
  const order: string[] = [];
  const byReason = new Map<string, { sentence: string; names: string[] }>();
  for (const row of rows) {
    const sentence = deliveryReasonSentence(row.reason, t);
    if (!byReason.has(sentence)) {
      byReason.set(sentence, { sentence, names: [] });
      order.push(sentence);
    }
    const name = typeof row.displayName === "string" ? row.displayName.trim() : "";
    if (name) byReason.get(sentence)!.names.push(name);
  }
  return order.map((k) => byReason.get(k)!);
}
