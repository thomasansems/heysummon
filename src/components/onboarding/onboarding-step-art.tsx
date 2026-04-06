"use client";

interface OnboardingStepArtProps {
  step: number;
}

export function OnboardingStepArt({ step }: OnboardingStepArtProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/30">
      <img
        src="/sumo.jpg"
        alt=""
        className="max-w-[320px] w-full h-auto rounded-lg opacity-80 shadow-2xl"
        style={{ filter: "saturate(1.1)" }}
      />
    </div>
  );
}
