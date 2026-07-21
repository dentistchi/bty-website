import { redirect } from "next/navigation";

/**
 * Middleware intercepts `/` first (locale-resolved → `/{locale}/app`, Slice 3.1B-3E.3); this
 * server fallback only renders if middleware is bypassed. Point it at the app-shell journey
 * (default `en`), never the legacy landing portal.
 */
export default function RootPage() {
  redirect("/en/app");
}
