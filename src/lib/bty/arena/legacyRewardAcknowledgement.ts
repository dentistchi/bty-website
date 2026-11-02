/** Public receipt shapes only; reward policy and stored amounts remain server-owned. */
export type LegacyChoiceAcknowledgement = {
  ok: true;
  reExposureDueCandidate: false;
  xp: number;
  receiptId: string;
  idempotent: boolean;
};

export type BeginnerCompletionAcknowledgement = {
  ok: true;
  beginner_maturity_score: number;
  band: "reactive" | "aware" | "intentional";
  label: string;
  message: string;
  receiptId: string;
  idempotent: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedInteger(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum;
}

function hasReceipt(value: Record<string, unknown>): boolean {
  return typeof value.receiptId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.receiptId) &&
    typeof value.idempotent === "boolean";
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function requireLegacyChoiceAcknowledgement(value: unknown): LegacyChoiceAcknowledgement {
  if (!isRecord(value) || value.ok !== true || value.reExposureDueCandidate !== false ||
    !boundedInteger(value.xp, 10_000) || !hasReceipt(value)) {
    throw new Error("REWARD_ACKNOWLEDGEMENT_INVALID");
  }
  return value as LegacyChoiceAcknowledgement;
}

export function requireBeginnerCompletionAcknowledgement(value: unknown): BeginnerCompletionAcknowledgement {
  if (!isRecord(value) || value.ok !== true || !boundedInteger(value.beginner_maturity_score, 20) ||
    (value.band !== "reactive" && value.band !== "aware" && value.band !== "intentional") ||
    !nonEmptyString(value.label) || !nonEmptyString(value.message) || !hasReceipt(value)) {
    throw new Error("REWARD_ACKNOWLEDGEMENT_INVALID");
  }
  return value as BeginnerCompletionAcknowledgement;
}

/** Do not expose response bodies, internal codes, or a false completion on a failed receipt. */
export function legacyRewardFailureMessage(error: unknown, locale: string): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "LEGACY_REWARD_REVIEW_REQUIRED") {
    return locale === "ko"
      ? "결과를 확인하려면 검토가 필요합니다. 입력한 답변은 그대로 남아 있습니다."
      : "This result needs review before it can be confirmed. Your answers are still here.";
  }
  if (code === "REWARD_INPUT_CONFLICT") {
    return locale === "ko"
      ? "이미 저장된 답변과 달라 결과를 확인하지 못했습니다. 입력한 답변은 그대로 남아 있습니다."
      : "This run has different saved answers, so we couldn't confirm the result. Your answers are still here.";
  }
  return locale === "ko"
    ? "결과를 확인하지 못했습니다. 입력한 답변은 그대로 남아 있습니다. 다시 시도해 주세요."
    : "We couldn't confirm your result. Your answers are still here. Please try again.";
}
