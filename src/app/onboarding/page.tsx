import type { Metadata } from "next";
import { OnboardingForm } from "@/features/onboarding/ui/OnboardingForm";

export const metadata: Metadata = { title: "Pick your username" };

export default function OnboardingPage() {
  return <OnboardingForm />;
}
