import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import VerifyClient from "./verify-client";

export default async function VerifyPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/auth");

  return <VerifyClient email={session.user.email} />;
}
