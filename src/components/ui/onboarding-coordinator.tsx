"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import Onboarding from "./onboarding";
import OnboardingWizard from "./onboarding-wizard";

type Phase = "checking" | "slides" | "wizard" | "done";

export default function OnboardingCoordinator() {
  const { data: session } = useSession();
  const [phase, setPhase] = React.useState<Phase>("checking");

  React.useEffect(() => {
    // Wait until session has resolved
    if (!session?.user) return;

    // localStorage is the source of truth per browser, so that:
    // - new users always see slides → wizard → app
    // - returning users on the same browser skip directly to the app
    // - returning users on a fresh browser get re-introduced (the wizard
    //   re-saves the profile, which is idempotent)
    const uid       = session.user.email ?? session.user.id ?? "anon";
    const slidesKey = `meetbox_slides_${uid}`;
    const wizardKey = `meetbox_wizard_${uid}`;

    const slidesDone = !!localStorage.getItem(slidesKey);
    const wizardDone = !!localStorage.getItem(wizardKey);

    if (!slidesDone)       setPhase("slides");
    else if (!wizardDone)  setPhase("wizard");
    else                   setPhase("done");
  }, [session]);

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
