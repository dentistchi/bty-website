/**
 * Action contract display rules (pure). DB `status` + `required` → UI hub `display_state`.
 */
/** DB statuses; `approved` = verified execution (ENGINE); `completed` kept for legacy reads only. */
export type BtyActionContractStatus =
  | "draft"
  | "committed"
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "escalated"
  | "completed"
  | "missed";

export type BtyActionContractVerificationMode = "qr" | "link" | "hybrid" | "self_report";

export type ActionContractDisplayState =
  | "action_required"
  | "action_submitted"
  | "action_awaiting_verification"
  | "verified_completed"
  | "missed"
  | "blocked";

export function toDisplayState(
  status: BtyActionContractStatus,
  required: boolean,
  options?: {
    validationApprovedAt?: string | null;
    verifiedAt?: string | null;
  },
): ActionContractDisplayState {
  const hasValidationApproval =
    typeof options?.validationApprovedAt === "string" && options.validationApprovedAt.trim().length > 0;
  const hasVerification = typeof options?.verifiedAt === "string" && options.verifiedAt.trim().length > 0;

  if (status === "draft" || status === "committed") return "action_required";
  if (status === "pending" && required) return "blocked";
  if (status === "pending") return "action_required";
  if (status === "submitted" || status === "escalated" || status === "rejected") {
    return hasValidationApproval && !hasVerification
      ? "action_awaiting_verification"
      : "action_submitted";
  }
  if (status === "approved" && hasVerification) return "verified_completed";
  if (status === "approved") return "action_awaiting_verification";
  if (status === "completed") return "verified_completed";
  if (status === "missed") return "missed";
  return "action_required";
}
