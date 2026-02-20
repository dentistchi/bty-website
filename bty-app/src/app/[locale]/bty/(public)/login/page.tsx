import LoginClient from "./LoginClient";
import { LoginLocaleWrapper } from "./LoginLocaleWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const nextParam = params?.next;
  const next =
    typeof nextParam === "string"
      ? nextParam
      : Array.isArray(nextParam)
      ? nextParam[0]
      : "";

  return <LoginLocaleWrapper nextPath={next || ""} />;
}
