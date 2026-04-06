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

export type BtyActionContractVerificationMode = "qr" | "link" | "hybrid";

export function toDisplayState(
  status: BtyActionContractStatus,
  required: boolean,
): "pending" | "completed" | "missed" | "blocked" {
  if (status === "draft" || status === "committed") return "pending";
  if (status === "pending" && required) return "blocked";
  if (status === "pending") return "pending";
  if (status === "approved" || status === "completed") return "completed";
  if (status === "missed") return "missed";
  if (status === "submitted" || status === "escalated" || status === "rejected") return "pending";
  return "pending";
}
