"use client";

import BtyLoginForm from "@/components/auth/BtyLoginForm";

export default function LoginClient({ nextPath }: { nextPath: string }) {
  return <BtyLoginForm nextPath={nextPath} />;
}
