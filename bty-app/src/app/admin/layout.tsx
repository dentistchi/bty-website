import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServerReadonly } from "@/lib/supabase-server-readonly";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServerReadonly();
  if (!supabase) {
    redirect("/admin/login");
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/admin/login?next=${encodeURIComponent("/admin")}`);
  }

  return <>{children}</>;
}
