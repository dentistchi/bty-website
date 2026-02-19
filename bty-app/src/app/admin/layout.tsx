import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerComponentSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createServerComponentSupabaseClient();
  if (!supabase) {
    redirect("/admin/login?error=config");
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/admin/login?next=/admin");
  }

  return <>{children}</>;
}
