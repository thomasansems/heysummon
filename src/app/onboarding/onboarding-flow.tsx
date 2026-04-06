"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { StepNetwork } from "@/components/onboarding/step-network";
import { StepExpert } from "@/components/onboarding/step-expert";
import { StepTestExpert } from "@/components/onboarding/step-test-expert";
import { StepClient } from "@/components/onboarding/step-client";
import { StepTestE2e, type E2eStatus } from "@/components/onboarding/step-test-e2e";
import { StepComplete } from "@/components/onboarding/step-complete";
import { E2eLiveView } from "@/components/onboarding/e2e-live-view";
import { OnboardingStepArt } from "@/components/onboarding/onboarding-step-art";
import type { ExpertChannelType } from "@/components/shared/channel-selector";
import type {
  ClientChannelType,
  ClientSubChannelType,
} from "@/components/shared/client-channel-selector";

const STEPS = [
  { label: "Expert" },
  { label: "Network" },
  { label: "Test" },
  { label: "Client" },
  { label: "E2E" },
  { label: "Done" },
];

const STORAGE_KEY = "heysummon_onboarding";

interface OnboardingState {
  step: number;
  expertId: string | null;
  expertKey: string | null;
  expertName: string | null;
  expertChannel: ExpertChannelType | null;
  clientKeyId: string | null;
  clientApiKey: string | null;
  clientChannel: ClientChannelType | null;
  clientSubChannel: ClientSubChannelType | null;
  clientName: string | null;
}

const DEFAULT_STATE: OnboardingState = {
  step: 1,
  expertId: null,
  expertKey: null,
  expertName: null,
  expertChannel: null,
  clientKeyId: null,
  clientApiKey: null,
  clientChannel: null,
  clientSubChannel: null,
  clientName: null,
};

function loadState(): OnboardingState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_STATE;
}

function saveState(state: OnboardingState) {
  try {
    const { expertKey, clientApiKey, ...safe } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // ignore
  }
}

function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function OnboardingFlow() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>(loadState);
  const [e2eStatus, setE2eStatus] = useState<E2eStatus>("ready");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const setStep = useCallback((step: number) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const handleSkip = useCallback(async () => {
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } finally {
      clearState();
      router.push("/dashboard");
    }
  }, [router]);

  const handleRestart = useCallback(() => {
    clearState();
    setState(DEFAULT_STATE);
  }, []);

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return (
          <StepExpert
            onComplete={({ expertId, expertKey, expertName, channel }) => {
              setState((s) => ({
                ...s,
                step: 2,
                expertId,
                expertKey,
                expertName,
                expertChannel: channel,
              }));
            }}
          />
        );

      case 2:
        // OpenClaw is polling-based — no public access needed
        if (state.expertChannel === "openclaw") {
          setStep(3);
          return null;
        }
        return <StepNetwork onNext={() => setStep(3)} />;

      case 3:
        if (!state.expertId || !state.expertChannel) {
          setStep(1);
          return null;
        }
        return (
          <StepTestExpert
            expertId={state.expertId}
            channel={state.expertChannel}
            onSuccess={() => setStep(4)}
          />
        );

      case 4:
        if (!state.expertId) {
          setStep(1);
          return null;
        }
        return (
          <StepClient
            expertId={state.expertId}
            expertName={state.expertName ?? "Your Expert"}
            onComplete={({ keyId, apiKey, channel, subChannel, clientName }) => {
              setState((s) => ({
                ...s,
                step: 5,
                clientKeyId: keyId,
                clientApiKey: apiKey,
                clientChannel: channel,
                clientSubChannel: subChannel,
                clientName: clientName || null,
              }));
            }}
          />
        );

      case 5:
        if (!state.clientKeyId) {
          setStep(4);
          return null;
        }
        return (
          <StepTestE2e
            apiKeyId={state.clientKeyId}
            expertName={state.expertName ?? "Expert"}
            expertChannel={state.expertChannel}
            onSuccess={() => setStep(6)}
            onStatusChange={setE2eStatus}
          />
        );

      case 6:
        clearState();
        return (
          <StepComplete
            expertName={state.expertName ?? "Expert"}
            clientName={state.clientName ?? "Client"}
          />
        );

      default:
        setStep(1);
        return null;
    }
  };

  // Show step-specific art on the right side; step 5 keeps the live E2E demo
  const sideContent =
    state.step === 5 ? (
      <E2eLiveView
        status={e2eStatus}
        expertChannel={state.expertChannel}
      />
    ) : (
      <OnboardingStepArt step={state.step} />
    );

  return (
    <OnboardingShell
      currentStep={state.step - 1}
      steps={STEPS}
      expertName={state.expertName}
      onSkip={handleSkip}
      onRestart={handleRestart}
      showSkip={state.step > 0 && state.step < 6}
      sideContent={sideContent}
    >
      {renderStep()}
    </OnboardingShell>
  );
}
