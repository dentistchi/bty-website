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

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServerReadonly();
  if (!supabase) {
    redirect("/admin/login");
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/admin/login?next=${encodeURIComponent("/admin")}`);
  }

  if (ADMIN_EMAIL_SET.size > 0) {
    const email = (data.user.email ?? "").toLowerCase();
    if (!email || !ADMIN_EMAIL_SET.has(email)) {
      redirect("/admin/login?next=/admin&error=forbidden");
    }
  }

  return <>{children}</>;
}
