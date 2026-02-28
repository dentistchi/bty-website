import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServerReadonly } from "@/lib/supabase-server-readonly";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_EMAILS = (process.env.BTY_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_EMAIL_SET = new Set(ADMIN_EMAILS);

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

  if (ADMIN_EMAIL_SET.size > 0) {
    const email = (data.user.email ?? "").toLowerCase();
    if (!email || !ADMIN_EMAIL_SET.has(email)) {
      redirect(`${base}/login?next=${base}&error=forbidden`);
    }
  }

  return <>{children}</>;
}
