import TeamsLinkDone from "@/components/teams/TeamsLinkDone";

export const dynamic = "force-dynamic";

/** `/teams/link/done` — first-ever sign-in popup, callback page. Returns only "ok". Slice A0. */
export default function TeamsLinkDonePage() {
  return <TeamsLinkDone />;
}
