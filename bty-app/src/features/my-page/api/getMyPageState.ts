import type { ReflectionEntry } from "@/features/growth/logic/types";
import type { ArenaSignal, LeadershipMetrics, LeadershipState } from "@/features/my-page/logic/types";
import type { MyPageOpenActionContractUi } from "@/lib/bty/my-page/openActionContractForMyPage";

export type MyPageStateResponse = {
  metrics: LeadershipMetrics;
  leadershipState: LeadershipState;
  recoveryTriggered: boolean;
  recoveryEntryCount: number;
  signals: ArenaSignal[];
  reflections: ReflectionEntry[];
  open_action_contract: MyPageOpenActionContractUi | null;
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
