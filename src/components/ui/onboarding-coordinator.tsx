"use client";

import * as React from "react";
import Onboarding from "./onboarding";
import OnboardingWizard, { WIZARD_DONE_KEY } from "./onboarding-wizard";

type Phase = "slides" | "wizard" | "done";

interface Props {
  serverOnboarded: boolean;
}

export default function OnboardingCoordinator({ serverOnboarded }: Props) {
  const [phase, setPhase] = React.useState<Phase>("done");

  React.useEffect(() => {
    const slidesDone = !!localStorage.getItem("meetbox_onboarding_done");
    const localDone  = !!localStorage.getItem(WIZARD_DONE_KEY);

    // Sincroniza DB → localStorage para que futuros reloads sean instantáneos
    if (serverOnboarded && !localDone) {
      localStorage.setItem(WIZARD_DONE_KEY, "1");
    }

    const wizardDone = serverOnboarded || localDone;

    if (!slidesDone)       setPhase("slides");
    else if (!wizardDone)  setPhase("wizard");
  }, [serverOnboarded]);

  if (phase === "slides") return <Onboarding  onComplete={() => setPhase("wizard")} />;
  if (phase === "wizard") return <OnboardingWizard onComplete={() => setPhase("done")} />;
  return null;
}
