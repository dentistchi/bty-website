/**
 * Notify admin when a new Arena membership request is submitted (pending).
 * Uses Resend when RESEND_API_KEY is set; otherwise logs only.
 */

const DEFAULT_ADMIN_EMAIL = "ddshanbit@gmail.com";

function getAdminEmail(): string {
  const env = process.env.BTY_ADMIN_EMAILS;
  if (env && typeof env === "string") {
    const first = env.split(",").map((e) => e.trim()).filter(Boolean)[0];
    if (first) return first;
  }
  return DEFAULT_ADMIN_EMAIL;
}

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

  const adminEmail = getAdminEmail();
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
          to: [adminEmail],
          subject: `[Arena] 멤버십 승인 대기: ${payload.userEmail}`,
          text: body,
        }),
      });
      const resBody = await res.text();
      if (res.ok) {
        console.log("[notifyMembershipRequestPending] 이메일 발송 성공. 수신:", adminEmail);
      } else {
        console.warn("[notifyMembershipRequestPending] Resend 실패:", res.status, resBody);
      }
    } catch (e) {
      console.warn("[notifyMembershipRequestPending] Resend 예외:", e);
    }
    return;
  }

  console.log("[notifyMembershipRequestPending] 이메일 발송 예정 (RESEND_API_KEY 없음). 수신:", adminEmail, "\n", body);
}
