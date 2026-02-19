import LoginClient from "./LoginClient";
import { sanitizeNext } from "@/lib/sanitize-next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = { next?: string };

export default function Page({ searchParams }: { searchParams?: SP }) {
  const nextPath = sanitizeNext(searchParams?.next);
  return <LoginClient nextPath={nextPath} />;
}
