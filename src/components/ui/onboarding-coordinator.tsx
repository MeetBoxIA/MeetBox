"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import Onboarding from "./onboarding";
import OnboardingWizard from "./onboarding-wizard";

type Phase = "checking" | "slides" | "wizard" | "done";

interface Props { serverOnboarded: boolean }

export default function OnboardingCoordinator({ serverOnboarded }: Props) {
  const { data: session } = useSession();
  const [phase, setPhase] = React.useState<Phase>(
    serverOnboarded ? "done" : "checking",
  );

  React.useEffect(() => {
    // If DB says onboarded, nothing else to do
    if (serverOnboarded) { setPhase("done"); return; }

    // Wait until session has resolved
    if (!session?.user) return;

    // Build keys unique to this user so different accounts on the same
    // browser each get their own onboarding state.
    const uid      = session.user.email ?? session.user.id ?? "anon";
    const slidesKey = `meetbox_slides_${uid}`;
    const wizardKey = `meetbox_wizard_${uid}`;

    const slidesDone = !!localStorage.getItem(slidesKey);
    const wizardDone = !!localStorage.getItem(wizardKey);

    if (!slidesDone)       setPhase("slides");
    else if (!wizardDone)  setPhase("wizard");
    else                   setPhase("done");
  }, [session, serverOnboarded]);

  function handleSlidesComplete() {
    const uid = session?.user?.email ?? session?.user?.id ?? "anon";
    localStorage.setItem(`meetbox_slides_${uid}`, "1");
    setPhase("wizard");
  }

  function handleWizardComplete() {
    const uid = session?.user?.email ?? session?.user?.id ?? "anon";
    localStorage.setItem(`meetbox_wizard_${uid}`, "1");
    setPhase("done");
  }

  if (phase === "checking" || phase === "done") return null;
  if (phase === "slides") return <Onboarding onComplete={handleSlidesComplete} />;
  return <OnboardingWizard onComplete={handleWizardComplete} />;
}
