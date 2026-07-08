import type { ReflectionEntry } from "@/features/growth/logic/types";
import type { LeadershipMetrics, LeadershipState } from "@/features/my-page/logic/types";
import type { MyPageOpenActionContractUi } from "@/lib/bty/my-page/openActionContractForMyPage";

/**
 * Quiet-mirror payload minimization: the authed My Page ships only the derived `signalCount`.
 * Raw metric numerics (xp / AIR / TII / relational/operational/emotional bias) and the raw
 * `signals[]` trait/meta vectors are intentionally NOT serialized — the authed UI renders none
 * of them (only `signalCount` drives dormant/active copy + the interpreted core-trace label).
 */
export type MyPagePublicMetrics = Pick<LeadershipMetrics, "signalCount">;

export type MyPageStateResponse = {
  metrics: MyPagePublicMetrics;
  leadershipState: LeadershipState;
  recoveryTriggered: boolean;
  recoveryEntryCount: number;
  reflections: ReflectionEntry[];
  open_action_contract: MyPageOpenActionContractUi | null;
  awaiting_verification_contracts: MyPageOpenActionContractUi[];
};

export async function getMyPageState(locale: string): Promise<MyPageStateResponse> {
  const loc = locale === "ko" ? "ko" : "en";
  const res = await fetch(`/api/bty/my-page/state?locale=${encodeURIComponent(loc)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error ?? "Failed to fetch my page state");
  }

  return res.json() as Promise<MyPageStateResponse>;
}
