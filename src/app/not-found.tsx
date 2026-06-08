import Link from "next/link";

export const metadata = { title: "Page not found | Center" };

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-gray-600 mb-2">The address is incorrect, or the page does not exist.</p>
      <p className="text-gray-500 text-sm mb-6">
        If you are running locally, use an address that starts with <strong>/en</strong> or <strong>/ko</strong>.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <Link href="/en" className="text-blue-600 underline">
          Home (EN)
        </Link>
        <Link href="/ko" className="text-blue-600 underline">
          홈 (KO)
        </Link>
        <Link href="/en/bty/login" className="text-blue-600 underline">
          Log in
        </Link>
        <Link href="/en/bty/dashboard" className="text-blue-600 underline">
          Dashboard
        </Link>
        <Link href="/ko/bty/dashboard" className="text-blue-600 underline">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
