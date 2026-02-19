"use client";

import { useSearchParams } from "next/navigation";
import { sanitizeNext } from "@/lib/sanitize-next";
import BtyLoginForm from "@/components/auth/BtyLoginForm";

export default function LoginClient() {
  const sp = useSearchParams();
  const nextPath = sanitizeNext(sp.get("next"));

  return <BtyLoginForm nextPath={nextPath} />;
}
