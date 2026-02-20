import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import TrainShell from "@/components/train/TrainShell";
import { getSupabaseServerReadonly } from "@/lib/supabase-server-readonly";
import LogoutButton from "@/components/auth/LogoutButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TrainLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServerReadonly();
  if (!supabase) {
    redirect("/bty/login");
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/bty/login?next=${encodeURIComponent("/train")}`);
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end px-4 py-2">
          <LogoutButton />
        </div>
      </div>
      <TrainShell>{children}</TrainShell>
    </div>
  );
}
