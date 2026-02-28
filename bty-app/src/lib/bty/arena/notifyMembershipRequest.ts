/**
 * Notify admin when a new Arena membership request is submitted (pending).
 * Placeholder: logs only. Replace with Resend/SendGrid when configured.
 */

const ADMIN_EMAIL = "ddshanbit@gmail.com";

export type MembershipRequestPayload = {
  userEmail: string;
  jobFunction: string;
  joinedAt: string;
  leaderStartedAt?: string | null;
};

export async function notifyMembershipRequestPending(payload: MembershipRequestPayload): Promise<void> {
  const body = [
    `승인 대기: ${payload.userEmail}`,
    `직군: ${payload.jobFunction}`,
    `입사일: ${payload.joinedAt}`,
    payload.leaderStartedAt ? `리더시작일: ${payload.leaderStartedAt}` : null,
    "",
    "Admin 대시보드에서 승인해 주세요: /admin/arena-membership",
  ]
    .filter(Boolean)
    .join("\n");

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? "Arena <onboarding@resend.dev>",
          to: [ADMIN_EMAIL],
          subject: `[Arena] 멤버십 승인 대기: ${payload.userEmail}`,
          text: body,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.warn("[notifyMembershipRequestPending] Resend failed:", res.status, err);
      }
    } catch (e) {
      console.warn("[notifyMembershipRequestPending] Resend error:", e);
    }
    return;
  }

  console.log("[notifyMembershipRequestPending] 이메일 발송 예정 (설정 없음). 수신:", ADMIN_EMAIL, "\n", body);
}
