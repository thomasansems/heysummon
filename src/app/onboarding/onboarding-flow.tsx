"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { StepWelcome } from "@/components/onboarding/step-welcome";
import { StepNetwork } from "@/components/onboarding/step-network";
import { StepProvider } from "@/components/onboarding/step-provider";
import { StepTestProvider } from "@/components/onboarding/step-test-provider";
import { StepClient } from "@/components/onboarding/step-client";
import { StepTestE2e } from "@/components/onboarding/step-test-e2e";
import { StepFirstRequest } from "@/components/onboarding/step-first-request";
import { StepComplete } from "@/components/onboarding/step-complete";
import { E2eLiveView } from "@/components/onboarding/e2e-live-view";
import type { ProviderChannelType } from "@/components/shared/channel-selector";
import type {
  ClientChannelType,
  ClientSubChannelType,
} from "@/components/shared/client-channel-selector";

const STEPS = [
  { label: "Welcome" },
  { label: "Network" },
  { label: "Provider" },
  { label: "Test" },
  { label: "Client" },
  { label: "E2E" },
  { label: "Try it" },
  { label: "Done" },
];

const STORAGE_KEY = "heysummon_onboarding";

interface OnboardingState {
  step: number;
  providerId: string | null;
  providerKey: string | null;
  providerName: string | null;
  providerChannel: ProviderChannelType | null;
  clientKeyId: string | null;
  clientApiKey: string | null;
  clientChannel: ClientChannelType | null;
  clientSubChannel: ClientSubChannelType | null;
  clientName: string | null;
}

const DEFAULT_STATE: OnboardingState = {
  step: 0,
  providerId: null,
  providerKey: null,
  providerName: null,
  providerChannel: null,
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

type E2eStatus =
  | "ready"
  | "sending"
  | "waiting_provider"
  | "waiting_response"
  | "complete"
  | "timeout";

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

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BASE_URL ?? "";

  const renderStep = () => {
    switch (state.step) {
      case 0:
        return <StepWelcome onNext={() => setStep(1)} />;

      case 1:
        return <StepNetwork onNext={() => setStep(2)} />;

      case 2:
        return (
          <StepProvider
            onComplete={({ providerId, providerKey, providerName, channel }) => {
              setState((s) => ({
                ...s,
                step: 3,
                providerId,
                providerKey,
                providerName,
                providerChannel: channel,
              }));
            }}
          />
        );

      case 3:
        if (!state.providerId || !state.providerChannel) {
          setStep(2);
          return null;
        }
        return (
          <StepTestProvider
            providerId={state.providerId}
            channel={state.providerChannel}
            onSuccess={() => setStep(4)}
          />
        );

      case 4:
        if (!state.providerId) {
          setStep(2);
          return null;
        }
        return (
          <StepClient
            providerId={state.providerId}
            providerName={state.providerName ?? "Your Provider"}
            baseUrl={baseUrl}
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
            onSuccess={() => setStep(6)}
            onStatusChange={setE2eStatus}
          />
        );

      case 6:
        return (
          <StepFirstRequest
            clientChannel={state.clientChannel}
            onNext={() => setStep(7)}
          />
        );

      case 7:
        clearState();
        return (
          <StepComplete
            providerName={state.providerName ?? "Provider"}
            clientName={state.clientName ?? "Client"}
          />
        );

      default:
        return <StepWelcome onNext={() => setStep(1)} />;
    }
  };

  // Show the live E2E demo in the side panel during step 5
  const sideContent =
    state.step === 5 ? (
      <E2eLiveView
        status={e2eStatus}
        providerChannel={state.providerChannel}
      />
    ) : undefined;

  return (
    <OnboardingShell
      currentStep={state.step}
      totalSteps={STEPS.length}
      providerName={state.providerName}
      onSkip={handleSkip}
      showSkip={state.step > 0 && state.step < 7}
      sideContent={sideContent}
    >
      {renderStep()}
    </OnboardingShell>
  );
}
