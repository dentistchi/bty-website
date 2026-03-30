/**
 * Action contract display rules (pure). DB `status` + `required` → UI hub `display_state`.
 */
export type BtyActionContractStatus = "pending" | "completed" | "missed";

export type BtyActionContractVerificationMode = "qr" | "link" | "hybrid";

export function toDisplayState(
  status: BtyActionContractStatus,
  required: boolean,
): "pending" | "completed" | "missed" | "blocked" {
  if (status === "pending" && required) return "blocked";
  if (status === "pending") return "pending";
  if (status === "completed") return "completed";
  if (status === "missed") return "missed";
  return "pending";
}
