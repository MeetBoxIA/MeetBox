import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import OnboardingCoordinator from "@/components/ui/onboarding-coordinator";
import DashboardShell from "@/components/dashboard/dashboard-shell";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/auth");

  const { data: dbUser } = await getSupabase()
    .from("users")
    .select("id")
    .eq("email", session.user!.email!)
    .maybeSingle();

  const { data: profile } = dbUser
    ? await getSupabase()
        .from("user_profiles")
        .select("onboarded_at, org_name, team_size, meeting_types, integrations")
        .eq("user_id", dbUser.id)
        .maybeSingle()
    : { data: null };

  const integrations    = (profile?.integrations  as string[] | null) ?? [];
  const meetingTypes    = (profile?.meeting_types as string[] | null) ?? [];

  return (
    <>
      <OnboardingCoordinator />
      <DashboardShell
        user={{
          name:  session.user!.name  ?? "Usuario",
          email: session.user!.email ?? "",
          image: session.user!.image ?? null,
        }}
        profile={{
          orgName:      profile?.org_name  ?? null,
          teamSize:     profile?.team_size ?? null,
          meetingTypes,
          integrations,
        }}
      />
    </>
  );
}
