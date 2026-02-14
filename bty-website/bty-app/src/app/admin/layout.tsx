import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-nextauth";
import { isAdmin } from "@/lib/rbac";
import { AdminHeader } from "@/components/admin/AdminHeader";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login?next=/admin/quality");
  }
  if (!isAdmin(session)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-neutral-800">권한이 없습니다</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Admin 대시보드에 접근할 수 없습니다.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminHeader />
      {children}
    </div>
  );
}
