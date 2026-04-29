import Link from "next/link";

export function DashboardBackLink({ locale }: { locale: string }) {
  return (
    <div className="mb-4 -mt-1">
      <Link
        href={`/${locale}/bty/dashboard`}
        className="inline-flex items-center gap-1 text-xs text-[#667085] hover:text-[#1E2A38] transition-colors"
      >
        <span aria-hidden>←</span>
        <span>Dashboard</span>
      </Link>
    </div>
  );
}
