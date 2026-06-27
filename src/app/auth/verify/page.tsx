import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import VerifyClient from "./verify-client";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/auth");

  const sp = await searchParams;
  const callbackUrlRaw = sp.callbackUrl;
  const callbackUrl = typeof callbackUrlRaw === "string" ? callbackUrlRaw : undefined;

  return <VerifyClient email={session.user.email} callbackUrl={callbackUrl} />;
}
