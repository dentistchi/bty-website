import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerComponentSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BtyLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerComponentSupabaseClient();
  if (!supabase) {
    redirect("/bty/login?error=config");
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/bty/login?next=/bty");
  }

  return <>{children}</>;
}
