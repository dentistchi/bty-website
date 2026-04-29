import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServerReadonly } from "@/lib/supabase-server-readonly";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_EMAILS = (process.env.BTY_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_EMAIL_SET = new Set(ADMIN_EMAILS);

function logAdminAllowlistDebug(email: string, matched: boolean) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[admin-auth][AdminLayout] allowlist check", {
    userEmail: email,
    parsedAdminEmails: ADMIN_EMAILS,
    allowlistMatched: matched,
  });
}

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  const base = `/${locale}/admin`;

  const supabase = await getSupabaseServerReadonly();
  if (!supabase) {
    redirect(`${base}/login`);
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`${base}/login?next=${encodeURIComponent(base)}`);
  }

  const email = (data.user.email ?? "").toLowerCase();
  if (ADMIN_EMAIL_SET.size > 0) {
    const matched = Boolean(email) && ADMIN_EMAIL_SET.has(email);
    logAdminAllowlistDebug(email, matched);
    if (!matched) {
      redirect(`${base}/login?next=${base}&error=forbidden`);
    }
  } else {
    logAdminAllowlistDebug(email, true);
  }

  return (
    <>
      <AdminNav locale={locale} />
      <div className="pt-12">{children}</div>
    </>
  );
}
